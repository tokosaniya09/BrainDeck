import { StudySet } from "../types";

interface JobResponse {
  jobId?: string; // Optional now, because cache hits might not have a job ID
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: StudySet;
  error?: string;
}

export interface HistoryItem {
  id: number;
  topic: string;
  summary: string;
  estimated_study_time_minutes: number;
  created_at?: string;
}

const POLL_INTERVAL_MS = 2000; // Check every 2 seconds
const MAX_ATTEMPTS = 60; // Timeout after ~120 seconds (Increased for safety)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateStudySet = async (
  topic: string, 
  onStatusUpdate?: (status: string) => void
): Promise<StudySet> => {
  // 1. Submit the job (OR get instant result)
  if (onStatusUpdate) onStatusUpdate('initiating');
  
  const startResponse = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ topic }),
  });

  if (!startResponse.ok) {
    const errorData = await startResponse.json();
    throw new Error(errorData.error || 'Failed to start generation job');
  }

  const initialData: JobResponse = await startResponse.json();

  // ⚡ Optimization: Check for Immediate Cache Hit
  if (initialData.status === 'completed' && initialData.result) {
    if (onStatusUpdate) onStatusUpdate('completed');
    return initialData.result;
  }

  // If not cached, we need a job ID to poll
  const jobId = initialData.jobId;
  if (!jobId) {
    throw new Error("No Job ID received from server");
  }
  
  // 2. Poll for results
  let attempts = 0;
  
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    try {
      const statusResponse = await fetch(`/api/jobs/${jobId}`);
      
      if (!statusResponse.ok) {
         throw new Error('Failed to check job status');
      }
      
      const job: JobResponse = await statusResponse.json();
      
      if (job.status === 'completed' && job.result) {
        if (onStatusUpdate) onStatusUpdate('completed');
        return job.result;
      }
      
      if (job.status === 'failed') {
        throw new Error(job.error || 'Generation failed on server');
      }
      
      // Notify UI of current state
      if (onStatusUpdate) {
        if (job.status === 'pending') onStatusUpdate('queued');
        else if (job.status === 'processing') onStatusUpdate('processing');
      }
      
      // Still pending or processing, wait and retry
      await sleep(POLL_INTERVAL_MS);
      
    } catch (err) {
      console.warn(`Polling attempt ${attempts} failed:`, err);
      // We continue polling even if one request fails (transient network error)
      await sleep(POLL_INTERVAL_MS); 
    }
  }

  throw new Error('Generation timed out. The server is taking longer than expected.');
};

export const fetchHistory = async (): Promise<HistoryItem[]> => {
  const res = await fetch('/api/history');
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
};

export const fetchStudySet = async (id: number): Promise<StudySet> => {
  const res = await fetch(`/api/sets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch study set");
  return res.json();
};

export const fetchQueueStatus = async () => {
  const res = await fetch('/api/queue-status');
  if (!res.ok) return null;
  return res.json();
};