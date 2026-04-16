---
tags: [react, state-machines, xstate, usereducer, discriminated-unions, statecharts]
---

# State Machines

## When to use
Whenever you find yourself tracking the same logical flow with multiple boolean flags. The smell: `isLoading`, `isError`, `isSuccess`, `hasData`, `isSubmitting` all in one component. Those flags imply a finite set of valid states, but you've left it implicit — and now you have invalid combinations like `isLoading && isError`. Make the states explicit.

## Guidelines

- **Rule of thumb: more than 3 booleans tracking the same flow → collapse them into one `state` enum.** Each new boolean doubles the combinations; with 4 booleans you have 16 possible states and probably only 5 are valid. Discriminated unions make the invalid ones unrepresentable.
- **Default to `useReducer` + a discriminated-union state.** No library, no learning curve, full type safety. The reducer is exhaustive over events and the UI exhaustive over states.
- **Discriminated unions in the state shape are the key insight.** `{ status: 'loading' }` and `{ status: 'success'; data: T }` differ in shape — TypeScript narrows access to `data` only inside the `success` branch. Impossible states become impossible.
- **Reach for XState when you have orchestration complexity:** multi-step wizards with branching, interactive tutorials, video players (loading/buffering/playing/paused/seeking), drag-and-drop with hover targets, payment flows with retries, anything you'd draw on a whiteboard as a statechart. XState earns its weight when there are nested states, parallel regions, or the flow is non-linear.
- **XState v5 is actor-model based.** Use `setup({ types, actions, guards, actors })` then `createMachine` for type inference; `useMachine` from `@xstate/react` to bind into components. Hierarchical states (`states: { loading: { ... } }`), guards on transitions, and side effects via actions/actors keep the machine pure and testable.
- **Server-state machines are already solved — don't reinvent them.** TanStack Query owns loading/error/success/refetching for fetches. See `data-fetching.md`. Build state machines for **client** flows (wizards, modes, editing states), not for "I'm fetching a thing."
- **The URL is a state machine.** Routing libraries (Next.js, TanStack Router, React Router) ARE finite-state machines over URL patterns. Use them for navigation flows (e.g., a multi-page wizard with `/onboarding/profile` → `/onboarding/team`) rather than building a parallel in-memory machine. Bonus: shareable, refresh-survivable, back-button-correct.
- **Statecharts beat flowcharts.** Hierarchical (state-within-state) and parallel (independent simultaneous states) regions reduce combinatorial blowup. A video player's `playback` and `subtitles` states are parallel — you don't need a `playingWithSubtitlesOn` state.
- **Keep the machine pure.** Side effects (fetches, timers, navigation) belong in actions/actors, not inline in transitions. Makes the machine deterministic, testable, and visualizable.
- **Visualize.** XState's Stately Studio renders machines as inspectable diagrams. If you can't draw it, the design is probably wrong.
- **When NOT to use a state machine:**
  - Single boolean toggles (`isOpen`, `isExpanded`) — `useState` is fine.
  - One async fetch — TanStack Query.
  - Form state — React Hook Form already handles this.
  - Simple tab switching — `useState<'a' | 'b'>` is enough.
- **When NOT to reach for XState:** if `useReducer` + discriminated union covers it in 30 lines, don't add a dependency. XState is justified by orchestration complexity, not by "state management."

## Examples

### useReducer + discriminated union for async data

```ts
import { useReducer, useEffect, useCallback } from 'react';

type State<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

type Action<T> =
  | { type: 'fetch' }
  | { type: 'success'; data: T }
  | { type: 'failure'; error: Error }
  | { type: 'reset' };

function reducer<T>(state: State<T>, action: Action<T>): State<T> {
  switch (action.type) {
    case 'fetch':
      return { status: 'loading' };
    case 'success':
      return { status: 'success', data: action.data };
    case 'failure':
      return { status: 'error', error: action.error };
    case 'reset':
      return { status: 'idle' };
  }
}

export function useAsync<T>(fn: () => Promise<T>) {
  const [state, dispatch] = useReducer(reducer<T>, { status: 'idle' });

  const run = useCallback(async () => {
    dispatch({ type: 'fetch' });
    try {
      dispatch({ type: 'success', data: await fn() });
    } catch (e) {
      dispatch({ type: 'failure', error: e instanceof Error ? e : new Error(String(e)) });
    }
  }, [fn]);

  useEffect(() => { void run(); }, [run]);

  return { state, refetch: run };
}

// Consumer — TS narrows `data` inside the success branch
function UserCard({ id }: { id: string }) {
  const { state } = useAsync(() => fetchUser(id));
  switch (state.status) {
    case 'idle':
    case 'loading':
      return <Spinner />;
    case 'error':
      return <p>Error: {state.error.message}</p>;
    case 'success':
      return <p>{state.data.name}</p>;
  }
}
```

### Multi-step form wizard with XState v5

```ts
import { setup, assign } from 'xstate';
import { useMachine } from '@xstate/react';

interface WizardContext {
  profile: { name: string; email: string } | null;
  team: { name: string; size: number } | null;
  plan: 'free' | 'pro' | null;
}

type WizardEvent =
  | { type: 'profile.submit'; data: NonNullable<WizardContext['profile']> }
  | { type: 'team.submit'; data: NonNullable<WizardContext['team']> }
  | { type: 'plan.submit'; data: NonNullable<WizardContext['plan']> }
  | { type: 'back' };

const wizardMachine = setup({
  types: {} as { context: WizardContext; events: WizardEvent },
  actions: {
    saveProfile: assign({
      profile: ({ event }) => (event.type === 'profile.submit' ? event.data : null),
    }),
    saveTeam: assign({
      team: ({ event }) => (event.type === 'team.submit' ? event.data : null),
    }),
    savePlan: assign({
      plan: ({ event }) => (event.type === 'plan.submit' ? event.data : null),
    }),
  },
}).createMachine({
  id: 'onboarding',
  initial: 'profile',
  context: { profile: null, team: null, plan: null },
  states: {
    profile: {
      on: { 'profile.submit': { target: 'team', actions: 'saveProfile' } },
    },
    team: {
      on: {
        'team.submit': { target: 'plan', actions: 'saveTeam' },
        back: 'profile',
      },
    },
    plan: {
      on: {
        'plan.submit': { target: 'submitting', actions: 'savePlan' },
        back: 'team',
      },
    },
    submitting: {
      invoke: {
        src: 'submitOnboarding',
        onDone: 'done',
        onError: 'plan',
      },
    },
    done: { type: 'final' },
  },
});

export function OnboardingWizard() {
  const [state, send] = useMachine(wizardMachine);

  if (state.matches('profile')) {
    return <ProfileStep onSubmit={(data) => send({ type: 'profile.submit', data })} />;
  }
  if (state.matches('team')) {
    return <TeamStep onSubmit={(data) => send({ type: 'team.submit', data })} onBack={() => send({ type: 'back' })} />;
  }
  if (state.matches('plan')) {
    return <PlanStep onSubmit={(data) => send({ type: 'plan.submit', data })} onBack={() => send({ type: 'back' })} />;
  }
  if (state.matches('submitting')) return <Spinner />;
  return <Confirmation />;
}
```

### Parallel states for a video player

```ts
import { setup } from 'xstate';

export const playerMachine = setup({
  types: {} as {
    events:
      | { type: 'play' }
      | { type: 'pause' }
      | { type: 'subtitles.toggle' };
  },
}).createMachine({
  id: 'player',
  type: 'parallel',
  states: {
    playback: {
      initial: 'paused',
      states: {
        paused: { on: { play: 'playing' } },
        playing: { on: { pause: 'paused' } },
      },
    },
    subtitles: {
      initial: 'off',
      states: {
        off: { on: { 'subtitles.toggle': 'on' } },
        on: { on: { 'subtitles.toggle': 'off' } },
      },
    },
  },
});
```

## Antipatterns

- **Boolean flag soup.** `isLoading && !isError && hasData && !isSubmitting`. Replace with a discriminated union.
- **Reinventing TanStack Query as a state machine.** Server-state caching is solved; don't model it from scratch.
- **Side effects inside reducers.** Reducers are pure functions of `(state, action) → state`. Fire effects via `useEffect`, action creators, or XState actions/actors.
- **XState for a single toggle.** Wrong tool, wrong scale.
- **Storing routing state in a machine instead of the URL.** Breaks back/forward, refresh, and shareable links.
- **Untested machines.** Statecharts are pure logic — they're trivially testable. Write tests that assert reachable states and transitions.

## Checklist
- [ ] No `isFoo` + `isBar` + `isBaz` triplet tracking one flow — use a discriminated union
- [ ] State shape forbids invalid combinations (e.g., `data` only exists in `success` state)
- [ ] Reducer/machine is pure; side effects live in `useEffect`, actions, or actors
- [ ] Server fetches use TanStack Query, not a hand-rolled machine
- [ ] Multi-page flows live in the URL/router, not a parallel in-memory machine
- [ ] XState used only when orchestration complexity justifies the dependency
- [ ] Machines have unit tests covering reachable states and key transitions
- [ ] UI is exhaustive over the state union (TS will tell you if it isn't)
