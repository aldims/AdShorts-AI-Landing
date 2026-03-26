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

const studioModes = ["Script", "Voice", "Visual", "Captions"];
const studioLayers = [
  { label: "AI Script", value: "Hook / pacing / CTA" },
  { label: "Voice", value: "Natural RU narration" },
  { label: "Captions", value: "Auto-highlight timing" },
];
const waveformBars = [14, 22, 30, 18, 12, 26, 34, 17, 28, 20, 32, 16];

export function LandingPage({ session, onOpenSignup, onOpenSignin, onLogout, onOpenWorkspace }: Props) {
  const topic = "AI tools";
  const status = "Ready to generate";

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

          <PrimarySiteNav activeItem="home" onOpenStudio={openPrimaryFlow} />

          <div className="site-header__actions">
            <a
              className="site-header__link"
              href="https://t.me/AdShortsAIBot"
              target="_blank"
              rel="noopener noreferrer"
            >
              Telegram
            </a>
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
        <section className="hero">
          <div className="hero__scene" aria-hidden="true">
            <span className="hero__scene-stars"></span>
            <span className="hero__scene-glow hero__scene-glow--left"></span>
            <span className="hero__scene-glow hero__scene-glow--center"></span>
            <span className="hero__scene-glow hero__scene-glow--right"></span>
            <span className="hero__scene-orbit hero__scene-orbit--one"></span>
            <span className="hero__scene-orbit hero__scene-orbit--two"></span>
            <span className="hero__scene-beam"></span>
          </div>

          <div className="container hero__grid">
            <div className="hero__copy">
              <p className="eyebrow">AI studio for short-form creators</p>
              <h1>
                <span className="hero__title-highlight">Shorts / Reels / TikTok</span>
                <span className="hero__title-subline">за 1 минуту. В один клик.</span>
              </h1>
              <p className="hero__lead">
                Превратите любую вашу идею в готовый Shorts.
              </p>

              <div className="hero__actions">
                <button className="btn btn--primary btn--hero route-button" type="button" onClick={openPrimaryFlow}>
                  Создать Shorts бесплатно
                </button>
              </div>

              <ul className="hero__features">
                <li>Оптимизирован под Shorts</li>
                <li>Всё делается автоматически</li>
                <li>Готово к публикации</li>
              </ul>

              <div className="hero__service-pills" aria-label="Что входит в ролик">
                <span className="hero__service-pill">AI сценарий</span>
                <span className="hero__service-pill">Озвучка</span>
                <span className="hero__service-pill">Визуал</span>
                <span className="hero__service-pill">Субтитры</span>
                <span className="hero__service-pill">Музыка</span>
                <span className="hero__service-pill">9:16</span>
              </div>
            </div>

            <aside className="hero-studio-card" aria-label="Studio preview card">
              <div className="hero-studio-card__shell">
                <div className="hero-studio-card__topbar">
                  <div className="hero-studio-card__brand">
                    <span className="hero-studio-card__brand-mark"></span>
                    <span>AdShorts Studio</span>
                  </div>
                  <div className="hero-studio-card__topmeta">
                    <span>Web beta</span>
                    <span>{status}</span>
                  </div>
                </div>

                <div className="hero-studio-card__workspace">
                  <div className="hero-studio-card__sidebar">
                    {studioModes.map((item, index) => (
                      <span className={index === 0 ? "is-active" : ""} key={item}>
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="hero-studio-card__preview">
                    <div className="hero-studio-card__canvas">
                      <div className="hero-studio-card__nebula"></div>
                      <div className="hero-studio-card__ring"></div>
                      <div className="hero-studio-card__caption">
                        <span className="hero-studio-card__caption-label">Preview script</span>
                        <strong>{topic}</strong>
                        <p>Один prompt превращается в hook, визуал и voiceover для вертикального ролика.</p>
                      </div>
                    </div>

                    <div className="hero-studio-card__layers">
                      {studioLayers.map((item) => (
                        <article key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </article>
                      ))}
                    </div>

                    <div className="hero-studio-card__timeline">
                      <div className="hero-studio-card__timeline-head">
                        <span>Timeline</span>
                        <span>0:58</span>
                      </div>
                      <div className="hero-studio-card__waveform" aria-hidden="true">
                        {waveformBars.map((height, index) => (
                          <span key={`${height}-${index}`} style={{ height }}></span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            
          </div>

          <div className="container hero__trust">
            <span className="hero__trust-label">Built for</span>
            <div className="hero__trust-list">
              <span>YouTube Shorts</span>
              <span>Instagram Reels</span>
              <span>TikTok</span>
              <span>Solo creators</span>
              <span>Brand teams</span>
              <span>Growth agencies</span>
            </div>
          </div>
        </section>

        <section className="section section--paper section--tight" id="product">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">ВСЁ ДЛЯ SHORTS В ОДНОМ СЕРВИСЕ</p>
              <h2>Превращайте идею в готовый Shorts в одном сервисе.</h2>
              <p>
                AdShorts AI автоматически создаёт сценарий, озвучку, визуал и субтитры. Вы получаете готовый
                вертикальный ролик без монтажа, сложных программ и переключения между сервисами.
              </p>
            </div>

            <div className="capability-grid">
              <article className="capability capability--lead">
                <h3>От идеи до готового Shorts — в одном сервисе</h3>
                <p>
                  Сценарий, озвучка, видеофон, субтитры и экспорт собираются в одном сервисе, чтобы вы могли создавать
                  готовые short-видео без монтажа и без сложных программ.
                </p>

                <div className="capability__list">
                  <span>Hook и структура</span>
                  <span>AI Сценарий</span>
                  <span>Визуал</span>
                  <span>Озвучка</span>
                  <span>Субтитры</span>
                  <span>Музыка</span>
                  <span>Автопубликация</span>
                </div>
              </article>

              <article className="capability">
                <span className="capability__label">HOOK И СТРУКТУРА</span>
                <h3>Сильное начало и понятная структура ролика</h3>
                <p>
                  Хук в первые секунды, правильный ритм и логичная структура, чтобы ролик удерживал внимание до конца.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">AI СЦЕНАРИЙ</span>
                <h3>Структура для первых секунд и удержания внимания</h3>
                <p>
                  Сильное начало, правильный ритм и логичный сценарий, оптимизированный для коротких вертикальных
                  видео.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">ВИЗУАЛ</span>
                <h3>Готовые сцены и единый стиль роликов</h3>
                <p>
                  Сцены, динамика и визуальный стиль создаются автоматически, чтобы ролики выглядели целостно и
                  профессионально.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">ОЗВУЧКА</span>
                <h3>Озвучка, которая звучит естественно</h3>
                <p>
                  Натуральное звучание, разные языки и быстрая настройка голоса, чтобы озвучка подходила под стиль
                  ролика.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">Субтитры</span>
                <h3>Субтитры с акцентами и правильным ритмом</h3>
                <p>
                  Выделение важных фраз, удобная скорость чтения и формат, который хорошо смотрится на мобильных
                  экранах.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">МУЗЫКА</span>
                <h3>Музыка, подходящая под ритм ролика</h3>
                <p>
                  Фоновая музыка подбирается автоматически, чтобы ролик звучал динамично и удерживал внимание.
                </p>
              </article>

              <article className="capability">
                <span className="capability__label">АВТОПУБЛИКАЦИЯ</span>
                <h3>Публикуйте сразу в YouTube Shorts</h3>
                <p>
                  Готовый ролик можно отправить в YouTube прямо из студии, без скачивания и без ручной загрузки.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--stone" id="studio">
          <div className="container">
            <div className="section-head section-head--split">
              <div>
                <p className="eyebrow eyebrow--dark">СТУДИЯ</p>
                <h2>Создавайте Shorts прямо в браузере.</h2>
                <p>
                  Создавайте Shorts в одном интерфейсе и получайте видео готовое к публикации за минуту.
                </p>
              </div>

            </div>

          </div>
        </section>

        <section className="section section--paper" id="examples">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">НЕСКОЛЬКО ВИДЕО ИЗ ОДНОЙ ИДЕИ</p>
              <h2>Создавайте несколько видео из одной идеи</h2>
              <p>
                AdShorts позволяет собирать разные версии коротких видео из одной темы, чтобы быстрее проверять идеи и
                делать серии контента без ручного монтажа.
              </p>
            </div>

            <div className="showcase-grid">
              <article className="showcase-card showcase-card--wide">
                <div className="showcase-card__media">
                  <div className="showcase-frame">
                    <span className="showcase-frame__label">Вариации из одной идеи</span>
                    <strong>Одна тема. Несколько версий. Быстрый тест.</strong>
                    <div className="showcase-frame__rails">
                      <span>Хуки</span>
                      <span>Озвучка</span>
                      <span>Визуальные стили</span>
                      <span>Субтитры</span>
                    </div>
                  </div>
                </div>

                <div className="showcase-card__copy">
                  <span className="showcase-card__label">Почему это важно</span>
                  <h3>Проверяйте гипотезы на нескольких версиях, а не на одном ролике.</h3>
                  <p>
                    AdShorts собирает несколько вариантов из одной темы: меняйте хук, ритм, озвучку и визуал, чтобы
                    быстрее найти формат, который удерживает и набирает просмотры.
                  </p>
                  <div className="showcase-metrics">
                    <article>
                      <strong>1 тема</strong>
                      <span>на входе</span>
                    </article>
                    <article>
                      <strong>3-5 версий</strong>
                      <span>на выходе</span>
                    </article>
                    <article>
                      <strong>0 монтажа</strong>
                      <span>вручную</span>
                    </article>
                  </div>
                </div>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Тест гипотез</span>
                <h3>Запускайте A/B-вариации коротких роликов за минуты.</h3>
                <p>
                  Делайте несколько версий с разными хуками и подачей, сравнивайте результаты и оставляйте только то,
                  что реально работает по удержанию.
                </p>
              </article>

              <article className="showcase-card">
                <span className="showcase-card__label">Серии контента</span>
                <h3>Собирайте контент-серии из одной идеи без потери стиля.</h3>
                <p>
                  Сервис сохраняет единый формат роликов: структура, визуал и ритм остаются согласованными, чтобы серия
                  выглядела цельно и узнаваемо.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--workflow">
          <div className="container">
            <div className="section-head">
              <p className="eyebrow eyebrow--dark">КАК ЭТО РАБОТАЕТ</p>
              <h2>От идеи до готового Shorts за 3 шага</h2>
              <p>
                Вы задаёте тему, сервис автоматически собирает сценарий, озвучку, визуал и субтитры, а на выходе
                получаете готовый ролик для публикации.
              </p>
            </div>

            <div className="steps-grid">
              <article className="step-card">
                <div className="step-card__num">01</div>
                <h3>Введите тему</h3>
                <p>Опишите идею ролика: тему, оффер или формат, который хотите протестировать в Shorts.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">02</div>
                <h3>Соберите видео автоматически</h3>
                <p>AdShorts AI создаёт сценарий, озвучку, визуал и субтитры в одном процессе — без ручного монтажа.</p>
              </article>

              <article className="step-card">
                <div className="step-card__num">03</div>
                <h3>Публикуйте готовый Shorts</h3>
                <p>Получите ролик, готовый к публикации в вертикальных форматах, и запускайте тесты сразу.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--stone" id="history">
          <div className="container trust-shell">
            <div className="trust-shell__copy">
              <p className="eyebrow eyebrow--dark">НАДЁЖНОСТЬ И СКОРОСТЬ</p>
              <h2>Результат за минуты, качество — на уровне продакшна.</h2>
              <p>
                AdShorts AI помогает быстро выпускать short-видео без потери качества: от идеи и сценария до готового
                ролика в одном сервисе.
              </p>
            </div>

            <div className="trust-stats">
              <article className="stat-card">
                <strong>50,000+</strong>
                <span>создателей и маркетологов</span>
              </article>
              <article className="stat-card">
                <strong>12M+</strong>
                <span>сгенерированных Shorts</span>
              </article>
              <article className="stat-card">
                <strong>4.9/5</strong>
                <span>средняя оценка пользователей</span>
              </article>
              <article className="stat-card">
                <strong>~1 мин</strong>
                <span>до первого готового ролика</span>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="pricing">
          <div className="container pricing-shell">
            <div className="pricing-shell__copy">
              <p className="eyebrow">ВЫБЕРИТЕ СВОЙ СЦЕНАРИЙ ЗАПУСКА</p>
              <h2>Выберите формат запуска под вашу задачу</h2>
              <p>
                Начните с веб-студии, если хотите быстро получить готовый Shorts в одном интерфейсе. Используйте
                Telegram-бот как дополнительный инструмент для масштабирования контента.
              </p>

              <div className="pricing-shell__actions">
                <button className="btn btn--primary route-button" type="button" onClick={openPrimaryFlow}>
                  Создать Shorts бесплатно
                </button>
              </div>
              <a
                className="pricing-shell__micro-link"
                href="https://t.me/AdShortsAIBot"
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть бота
              </a>
            </div>

            <div className="plan-grid">
              <article className="plan-card">
                <span className="plan-card__label">СТАРТ</span>
                <h3>Быстрый тест идеи</h3>
                <p>Для авторов, фаундеров и маркетологов, которым нужно быстро проверить идею в формате Shorts.</p>
                <ul className="plan-card__list">
                  <li>Сценарий, озвучка и визуал</li>
                  <li>Предпросмотр нескольких вариантов</li>
                  <li>Готовый ролик в формате 9:16</li>
                </ul>
              </article>

              <article className="plan-card plan-card--accent">
                <span className="plan-card__label">РОСТ</span>
                <h3>Система для контент-команды</h3>
                <p>Для агентств и команд, которым нужен единый процесс создания коротких видео без ручной сборки.</p>
                <ul className="plan-card__list">
                  <li>Переиспользуемые стили и шаблоны</li>
                  <li>Управление подачей и тоном озвучки</li>
                  <li>Пайплайн для серийного выпуска роликов</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section className="section section--paper section--guides" id="guides">
          <div className="container guides-strip">
            <div className="guides-strip__copy">
              <p className="eyebrow eyebrow--dark">ГАЙДЫ</p>
              <h2>Полезные материалы привлекают трафик и подводят к продукту.</h2>
            </div>

            <div className="guides-strip__cards">
              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/shorts-guides/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">БАЗА</span>
                <h3>Все гайды по Shorts в одном месте</h3>
                <p>Единая точка входа: идеи, структура ролика, удержание, оформление и публикация.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/kak-sdelat-huk-v-shorts/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">ХУК</span>
                <h3>Как сделать сильный первый экран</h3>
                <p>Что удерживает внимание и снижает вероятность свайпа.</p>
              </a>

              <a
                className="guide-card route-guide-link"
                href="http://127.0.0.1:4173/subtitry-dlya-shorts-avtomatom/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="guide-card__label">СУБТИТРЫ</span>
                <h3>Автоматические субтитры</h3>
                <p>Как субтитры помогают коротким видео работать даже без звука.</p>
              </a>
            </div>

            <a
              className="guides-strip__cta route-linkbtn"
              href="http://127.0.0.1:4173/shorts-guides/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Все материалы
            </a>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div>
            <p>App staging route for AdShorts AI.</p>
            <p>© 2026 AdShorts AI</p>
          </div>

          <div className="footer__links">
            <a href="#studio">Web studio</a>
            <a href="#guides">Guides</a>
            <a href="https://t.me/AdShortsAIBot" target="_blank" rel="noopener noreferrer">
              Telegram bot
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
