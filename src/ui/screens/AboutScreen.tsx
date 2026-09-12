import { useT } from '../../i18n';
import { navigate } from '../router';

export function AboutScreen() {
  const t = useT();
  return (
    <main className="screen">
      <div className="panel about">
        <header className="panel-header">
          <h2>{t('aboutTitle')}</h2>
          <button type="button" className="btn ghost" onClick={() => navigate('#/')}>
            {t('backToTitle')}
          </button>
        </header>

        <section>
          <h3>{t('rulesBrief')}</h3>
          <ul className="rules-list">
            <li>
              <strong>{t('termMonsters')}</strong>
              {t('restMonsters')} <strong>{t('termWeapons')}</strong>
              {t('restWeapons')} <strong>{t('termPotions')}</strong>
              {t('restPotions')}
            </li>
            <li>{t('ruleRooms')}</li>
            <li>{t('ruleDegradation')}</li>
            <li>{t('rulePotion')}</li>
            <li>{t('ruleRunAway')}</li>
            <li>{t('ruleWin')}</li>
          </ul>
        </section>

        <section>
          <h3>{t('credits')}</h3>
          <p className="muted">{t('creditsText')}</p>
          <ul className="links-list">
            <li>
              <a href="http://stfj.net/art/2011/Scoundrel.pdf" target="_blank" rel="noreferrer">
                {t('linkRulebook')}
              </a>
            </li>
            <li>
              <a href="https://rpdillon.net/scoundrel.html" target="_blank" rel="noreferrer">
                {t('linkAnnotated')}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
