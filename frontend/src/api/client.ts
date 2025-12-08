import { StudySet } from "../types";

interface JobResponse {
  jobId?: string;
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

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 60;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- Auth Headers ---
const getHeaders = () => {
  const headers: any = {
    'Content-Type': 'application/json',
  };
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// --- Auth API Calls ---
export const loginUser = async (email: string, password: string): Promise<{ token: string, user: any }> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Login failed');
  }
  return res.json();
};

export const signupUser = async (email: string, password: string, name: string): Promise<{ token: string, user: any }> => {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Signup failed');
  }
  return res.json();
};

export const loginWithGoogle = async (credential: string): Promise<{ token: string, user: any }> => {
  const res = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential })
  });
  
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Google login failed');
  }
  return res.json();
};


export const generateStudySet = async (
  topic: string, 
  onStatusUpdate?: (status: string) => void
): Promise<StudySet> => {
  if (onStatusUpdate) onStatusUpdate('initiating');
  
  const startResponse = await fetch('/api/generate', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ topic }),
  });

  if (!startResponse.ok) {
    const errorData = await startResponse.json();
    throw new Error(errorData.error || 'Failed to start generation job');
  }

  const initialData: JobResponse = await startResponse.json();

  if (initialData.status === 'completed' && initialData.result) {
    if (onStatusUpdate) onStatusUpdate('completed');
    return initialData.result;
  }

  const jobId = initialData.jobId;
  if (!jobId) {
    throw new Error("No Job ID received from server");
  }
  
  let attempts = 0;
  
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    try {
      const statusResponse = await fetch(`/api/jobs/${jobId}`, {
        headers: getHeaders()
      });
      
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
      
      if (onStatusUpdate) {
        if (job.status === 'pending') onStatusUpdate('queued');
        else if (job.status === 'processing') onStatusUpdate('processing');
      }
      
      await sleep(POLL_INTERVAL_MS);
      
    } catch (err) {
      console.warn(`Polling attempt ${attempts} failed:`, err);
      await sleep(POLL_INTERVAL_MS); 
    }
  }

  throw new Error('Generation timed out. The server is taking longer than expected.');
};

export const fetchHistory = async (): Promise<HistoryItem[]> => {
  const res = await fetch('/api/history', {
    headers: getHeaders()
  });
  if (res.status === 401) return []; // Not logged in
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
};

export const fetchStudySet = async (id: number): Promise<StudySet> => {
  const res = await fetch(`/api/sets/${id}`, {
    headers: getHeaders()
  });
  if (!res.ok) throw new Error("Failed to fetch study set");
  return res.json();
};

export const fetchQueueStatus = async () => {
  const res = await fetch('/api/queue-status');
  if (!res.ok) return null;
  return res.json();
};