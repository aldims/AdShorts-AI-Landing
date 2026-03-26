import { Link } from "react-router-dom";

import { AccountMenuButton } from "../components/AccountMenuButton";
import { PrimarySiteNav } from "../components/PrimarySiteNav";

type Session = {
  name: string;
  email: string;
  plan: string;
} | null;

type Props = {
  session: Session;
  onOpenSignup: () => void;
  onOpenSignin: () => void;
  onLogout: () => void | Promise<void>;
  onOpenWorkspace: () => void;
};

export function ExamplesPage({ session, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const openPrimaryFlow = () => {
    if (session) {
      onOpenWorkspace();
      return;
    }

    onOpenSignup();
  };

  return (
    <div className="route-page">
      <header className="site-header" id="top">
        <div className="container site-header__inner">
          <Link className="brand" to="/" aria-label="AdShorts AI">
            <img src="/logo.png" alt="" width="44" height="44" />
            <span>AdShorts AI</span>
          </Link>

          <PrimarySiteNav activeItem="examples" onOpenStudio={openPrimaryFlow} />

          <div className="site-header__actions">
            {session ? (
              <AccountMenuButton email={session.email} name={session.name} onLogout={onLogout} plan={session.plan} />
            ) : (
              <button className="site-header__link route-button" type="button" onClick={onOpenSignin}>
                Sign in
              </button>
            )}

            {!session ? (
              <button className="btn btn--header route-button" type="button" onClick={openPrimaryFlow}>
                Создать видео бесплатно
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main>
        <section className="section section--paper section--tight">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">ПРИМЕРЫ</p>
              <h2>Примеры роликов</h2>
              <p>
                Примеры структуры и идей для Shorts/Reels/TikTok — берите формат, подставляйте тему и запускайте
                генерацию в один клик.
              </p>
            </div>

            <div className="showcase-grid">
              <article className="showcase-card">
                <div className="showcase-card__media">
                  <div className="showcase-frame">
                    <span className="showcase-frame__label">Продажи услуг</span>
                    <strong>Хук → боль → решение → призыв</strong>
                  </div>
                </div>

                <div className="showcase-card__copy">
                  <span className="showcase-card__label">Шаблон</span>
                  <h3>Под услугу и заявку</h3>
                  <p>Сильный хук, логика по боли и понятный призыв к действию.</p>
                </div>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Контент-канал</span>
                <h3>Факты, подборки, цитаты</h3>
                <p>Делайте серию по одной теме и быстро находите “ваши” форматы.</p>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Маркетинг</span>
                <h3>A/B-тесты креативов</h3>
                <p>Запускайте вариации хука и подачу, чтобы выбрать лучший результат.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

