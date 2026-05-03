import { describe, expect, it } from 'vitest';
import { resolveEnvSwitchDestination } from './envRouteResolver';

describe('resolveEnvSwitchDestination', () => {
  it('redirects /logistique to /scenarios when target is preprod', () => {
    expect(resolveEnvSwitchDestination('/logistique', 'preprod')).toBe('/scenarios');
  });

  it('keeps /logistique when target is prod', () => {
    expect(resolveEnvSwitchDestination('/logistique', 'prod')).toBe('/logistique');
  });

  it('redirects nested /scenarios/:id to /logistique when target is prod', () => {
    expect(resolveEnvSwitchDestination('/scenarios/abc-123', 'prod')).toBe('/logistique');
  });

  it('preserves non-twin path /flux when target is preprod', () => {
    expect(resolveEnvSwitchDestination('/flux', 'preprod')).toBe('/flux');
  });

  it('preserves root / when target is prod', () => {
    expect(resolveEnvSwitchDestination('/', 'prod')).toBe('/');
  });
});
