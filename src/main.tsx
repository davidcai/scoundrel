import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';
import { loadSavedGame } from './store/use-saved-game';
import { translator } from './i18n/translate';

const root = createRoot(document.getElementById('root')!);
const locale = navigator.language.startsWith('zh') ? 'zh' : 'en';
root.render(
  <p className="loading" role="status">
    {translator(locale)('loading')}
  </p>,
);
void loadSavedGame().then((initial) =>
  root.render(
    <StrictMode>
      <App initial={initial} />
    </StrictMode>,
  ),
);
