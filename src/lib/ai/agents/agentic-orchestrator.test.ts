import { describe, it, expect, vi } from 'vitest';
import {
  decideNextAction,
  decideNextActionRuleBased,
  type DecisionContext,
  type ActionDecider,
} from './agentic-orchestrator';

/**
 * The orchestrator's next-action decision is now LLM-driven, with deterministic
 * hard guards (threshold / iteration ceiling) in front and the rule-based
 * heuristic behind as a fallback. These lock that control flow without ever
 * making a real model call — the decider is injected.
 */

const base: DecisionContext = {
  currentScore: 50,
  iteration: 1,
  maxIterations: 3,
  qualityThreshold: 80,
  issues: [],
};

describe('decideNextAction — hard guards (no model call)', () => {
  it('stops immediately when the quality threshold is met, without consulting the LLM', async () => {
    const llm = vi.fn<ActionDecider>();
    const decision = await decideNextAction(
      { ...base, currentScore: 85, qualityThreshold: 80 },
      llm
    );
    expect(decision.action).toBe('stop');
    expect(llm).not.toHaveBeenCalled();
  });

  it('stops at the iteration ceiling without consulting the LLM, even on a low score', async () => {
    const llm = vi.fn<ActionDecider>();
    const decision = await decideNextAction(
      { ...base, currentScore: 10, iteration: 3, maxIterations: 3 },
      llm
    );
    expect(decision.action).toBe('stop');
    expect(llm).not.toHaveBeenCalled();
  });
});

describe('decideNextAction — LLM primary path', () => {
  it('returns the model decision when below threshold and under the ceiling', async () => {
    const llm = vi
      .fn<ActionDecider>()
      .mockResolvedValue({ action: 'revise', reasoning: 'model says revise' });
    const decision = await decideNextAction(base, llm);
    expect(llm).toHaveBeenCalledOnce();
    expect(decision).toEqual({ action: 'revise', reasoning: 'model says revise' });
  });

  it('falls back to the rule-based heuristic when the model call throws', async () => {
    const llm = vi
      .fn<ActionDecider>()
      .mockRejectedValue(new Error('model unavailable'));
    const ctx = { ...base, currentScore: 40 }; // rule-based → revise
    const decision = await decideNextAction(ctx, llm);
    expect(llm).toHaveBeenCalledOnce();
    expect(decision).toEqual(decideNextActionRuleBased(ctx));
    expect(decision.action).toBe('revise');
  });
});

describe('decideNextActionRuleBased — fallback heuristic', () => {
  it('stops when the threshold is met', () => {
    expect(
      decideNextActionRuleBased({ ...base, currentScore: 90, qualityThreshold: 80 }).action
    ).toBe('stop');
  });

  it('asks for more research when there are many high-severity issues', () => {
    const issues = Array.from({ length: 4 }, (_, i) => ({ severity: 'high', issue: `bad ${i}` }));
    expect(decideNextActionRuleBased({ ...base, currentScore: 55, issues }).action).toBe(
      'research_more'
    );
  });

  it('revises on a low score with few issues', () => {
    expect(decideNextActionRuleBased({ ...base, currentScore: 40 }).action).toBe('revise');
  });

  it('stops for speed once an acceptable score is reached after an iteration', () => {
    expect(
      decideNextActionRuleBased({ ...base, currentScore: 62, iteration: 1, qualityThreshold: 80 })
        .action
    ).toBe('stop');
  });
});
