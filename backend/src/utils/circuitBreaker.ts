import { logger } from "./logger";

enum State {
  Closed,   // Normal operation
  Open,     // Failing, reject requests immediately
  HalfOpen  // Testing if service recovered
}

export class CircuitBreaker {
  private state = State.Closed;
  private failures = 0;
  private lastFailureTime = 0;
  
  // Configuration
  private readonly failureThreshold = 5; // Open after 5 failures
  private readonly cooldownPeriod = 30000; // 30 seconds cooldown

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === State.Open) {
      if (Date.now() - this.lastFailureTime > this.cooldownPeriod) {
        logger.info("CircuitBreaker: Cooldown passed, entering HALF-OPEN state.");
        this.state = State.HalfOpen;
      } else {
        throw new Error("CircuitBreaker: Service unavailable (Open state). Please try again later.");
      }
    }

    try {
      const result = await fn();
      
      if (this.state === State.HalfOpen) {
        this.reset();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    logger.warn(`CircuitBreaker: Failure recorded`, { failures: this.failures, threshold: this.failureThreshold });
    
    if (this.failures >= this.failureThreshold) {
      this.state = State.Open;
      logger.error("CircuitBreaker: Threshold reached. State changed to OPEN.");
    }
  }

  private reset() {
    this.failures = 0;
    this.state = State.Closed;
    logger.info("CircuitBreaker: Recovered. State changed to CLOSED.");
  }
}

// Singleton instance
export const aiCircuitBreaker = new CircuitBreaker();