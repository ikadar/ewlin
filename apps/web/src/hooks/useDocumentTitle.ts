import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type EnvDisplay = 'dynamic' | 'prod' | 'preprod' | 'none';

function envSuffix(display: EnvDisplay, search: string): string {
  if (display === 'none') return '';
  if (display === 'prod') return ' [PROD]';
  if (display === 'preprod') return ' [PREPROD]';
  const params = new URLSearchParams(search);
  return params.get('env') === 'prod' ? ' [PROD]' : ' [PREPROD]';
}

function buildTitle(page: string, env: EnvDisplay, search: string): string {
  if (!page) return 'Ordo';
  return `Ordo · ${page}${envSuffix(env, search)}`;
}

const STATIC_ROUTES: Array<{ pattern: RegExp; page: string; env: EnvDisplay }> = [
  { pattern: /^\/login$/, page: 'Connexion', env: 'none' },

  { pattern: /^\/flux\/bat$/, page: 'Flux BAT', env: 'dynamic' },
  { pattern: /^\/flux\/papier$/, page: 'Flux Papier', env: 'dynamic' },
  { pattern: /^\/flux\/formes$/, page: 'Flux Formes', env: 'dynamic' },
  { pattern: /^\/flux\/plaques$/, page: 'Flux Plaques', env: 'dynamic' },
  { pattern: /^\/flux\/soustraitance$/, page: 'Flux ST', env: 'dynamic' },
  { pattern: /^\/flux\/a-facturer$/, page: 'Flux Facturation', env: 'dynamic' },
  { pattern: /^\/flux$/, page: 'Flux', env: 'dynamic' },

  { pattern: /^\/stations(\/|$)/, page: 'Planning stations', env: 'dynamic' },
  { pattern: /^\/(job\/|$)/, page: 'Planning opérateur', env: 'dynamic' },

  { pattern: /^\/stats$/, page: 'Stats', env: 'preprod' },

  { pattern: /^\/prerequis\/papier$/, page: 'Papier', env: 'prod' },
  { pattern: /^\/prerequis\/formes$/, page: 'Formes', env: 'prod' },
  { pattern: /^\/prerequis\/bat$/, page: 'BAT', env: 'prod' },
  { pattern: /^\/prerequis\/plaques$/, page: 'Plaques', env: 'prod' },
  { pattern: /^\/prerequis/, page: 'Prérequis', env: 'prod' },
  { pattern: /^\/logistique$/, page: 'Logistique', env: 'prod' },
  { pattern: /^\/rapport-production$/, page: 'Rapport de prod', env: 'prod' },
  { pattern: /^\/facturation$/, page: 'Facturation', env: 'prod' },

  { pattern: /^\/historique\/archives/, page: 'Archives', env: 'none' },
  { pattern: /^\/historique/, page: 'Journal', env: 'none' },

  { pattern: /^\/scenarios\/[^/]+\/flux$/, page: 'Scénario Flux', env: 'preprod' },
  { pattern: /^\/scenarios\/[^/]+\/stations$/, page: 'Scénario Stations', env: 'preprod' },
  { pattern: /^\/scenarios\/[^/]+\/settings/, page: 'Scénario Réglages', env: 'preprod' },
  { pattern: /^\/scenarios\/[^/]+$/, page: 'Scénario', env: 'preprod' },
  { pattern: /^\/scenarios$/, page: 'Scénarios', env: 'preprod' },

  { pattern: /^\/settings/, page: 'Réglages', env: 'preprod' },
];

export function useRouteDocumentTitle() {
  const location = useLocation();

  useEffect(() => {
    for (const route of STATIC_ROUTES) {
      if (route.pattern.test(location.pathname)) {
        document.title = buildTitle(route.page, route.env, location.search);
        return;
      }
    }
    document.title = 'Ordo';
  }, [location.pathname, location.search]);
}

export function useDocumentTitle(page: string, env: EnvDisplay = 'none') {
  const location = useLocation();

  useEffect(() => {
    document.title = buildTitle(page, env, location.search);
  }, [page, env, location.search]);
}
