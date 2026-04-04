# План: редактор сегментов в `/app/studio` по аналогии с ботом

## Summary
- По клику `Редактировать` на видео во вкладке `Создать` студия не открывает модалку, а переключает текущий create-screen в режим редактирования сегментов.
- В `v1` делаем поведение как в боте: до 6 сегментов, для каждого можно менять видео сегмента и общий текст сегмента. Этот текст меняет и субтитры, и озвучку.
- Навигация по сегментам: горизонтальная карусель из 3 карточек, центральная карточка активная.
- Нижняя prompt-панель превращается в panel-editor текущего сегмента.
- Сохранение: явно `Применить`, затем отдельно `Перегенерировать`. Вход в `v1` только из `Создать`.

## Implementation Changes
### UX / Frontend
- Добавить в `WorkspacePage` отдельный режим внутри `studioView="create"`: `createMode = "default" | "segment-editor"`.
- По `Редактировать` открывать segment editor только если у текущего видео есть `adId`; иначе кнопка disabled.
- Верхняя область preview:
  - горизонтальная карусель из 3 segment-card;
  - центр: активный сегмент, крупный muted-loop preview;
  - слева/справа: соседние сегменты, уменьшенные и приглушённые;
  - стрелки влево/вправо + клавиатурное переключение.
- Нижняя область:
  - вместо prompt textarea и chips показывать editor panel активного сегмента;
  - два режима панели: `Видео` и `Текст`;
  - `Видео`: `AI-подбор`, `Вернуть исходное`, `Загрузить своё видео`;
  - `Текст`: одно поле текста сегмента, которое правит и subtitles, и voice text;
  - footer: `Отмена`, `Применить`.
- После `Применить`:
  - выйти из segment editor обратно в обычный create-screen;
  - сохранить локальную edit-session;
  - основной CTA меняется на `Перегенерировать`;
  - preview остаётся старым видео до новой сборки.
- `Отмена` внутри editor:
  - закрывает editor без коммита текущей edit-session;
  - возвращает обычную create-панель.
- В `v1` не открывать editor из `Мои проекты`.

### Landing / Web API
- Добавить новый auth-protected endpoint в landing:
  - `GET /api/workspace/projects/:projectId/segment-editor`
- Его задача:
  - загрузить нормализованную edit-session для проекта;
  - вернуть проектные метаданные и сегменты в форме, удобной для web UI.
- Добавить proxy endpoint для preview источника сегмента:
  - `GET /api/workspace/project-segment-video?projectId=...&segmentIndex=...&source=current|original`
- Расширить `POST /api/studio/generate` optional-полем `segmentEditor`:
  - `projectId`
  - `segments[]` с `index`, `text`, `videoAction: "original" | "ai" | "custom"`, optional custom video data.
- `segmentEditor` должен использоваться только при `isRegeneration=true` и наличии `projectId`.

### AdsFlow API / backend contract
- Добавить новый admin endpoint:
  - `GET /api/projects/{project_id}/segment-editor`
- Он должен вернуть уже нормализованную edit-session:
  - `project_id`, `title`, `description`, `subtitle_type`, `subtitle_style`, `subtitle_color`, `voice_type`, `music_type`
  - `segments[]` c `index`, `text`, `start_time`, `end_time`, `duration`, `current_video`, `original_video`
- Добавить media endpoint для segment preview:
  - `GET /api/projects/{project_id}/segments/{segment_index}/video?source=current|original`
- Расширить `WebGenerationCreateRequest`:
  - `project_id?: number`
  - `segment_editor?: { segments: [...] }`
- При наличии `project_id + segment_editor` `/api/web/generations` должен собирать bot-compatible edit payload:
  - `task_type = "video.edit"`
  - `existing_video_id = project_id`
  - `creation_data.step_data.current_edit_video_id = project_id`
  - `creation_data.step_data.original_video_segments = edited segments`
  - `creation_data.step_data.segment_video_changed = { ... }`
  - `creation_data.step_data.segment_ai_search = { ... }`
  - `creation_data.step_data.video_urls = updated video entries`
  - если менялся текст сегментов: пересобрать `combined_text` и записать его в те же поля, что использует бот
- Правила текста:
  - если проект в `subtitle_type="custom"`, `combined_text` идёт в `custom_text`;
  - иначе `combined_text` идёт в `current_subtitle_text`, `preview_ai_voice_text`, `preview_ai_script`;
  - также выставлять `subtitle_changed=true`.
- Для `custom` video segment:
  - API сохраняет uploaded asset во временный файл, доступный worker;
  - соответствующий `video_urls[index]` заменяется на custom entry;
  - индекс попадает в `segment_video_changed`.
- Для `AI` segment:
  - видео не меняется сразу;
  - индекс попадает в `segment_ai_search`.
- Для `original` segment:
  - очищаются оба флага;
  - в `video_urls[index]` возвращается original entry.

### Worker / generation pipeline
- Не вводить новый edit-engine.
- Использовать уже существующий `video.edit` flow в worker и bot-compatible keys:
  - `segment_video_changed`
  - `segment_ai_search`
  - `original_video_segments`
  - updated `video_urls`
  - updated combined subtitle/voice text
- Допустимы только точечные изменения worker, если web payload потребует небольшой normalization layer; новую механику редактирования в worker не придумывать.

## Public APIs / Types
- Landing:
  - `WorkspaceSegmentEditorSession`
  - `WorkspaceSegmentEditorSegment`
  - `POST /api/studio/generate` получает optional `segmentEditor`
- AdsFlow:
  - `GET /api/projects/{project_id}/segment-editor`
  - `GET /api/projects/{project_id}/segments/{segment_index}/video`
  - `WebGenerationCreateRequest.project_id?: number`
  - `WebGenerationCreateRequest.segment_editor?: { segments: [...] }`

## Test Plan
- Открытие editor:
  - клик `Редактировать` на create-preview переводит экран в segment editor;
  - editor не открывается без `adId`.
- Загрузка сессии:
  - для проекта с 1-6 сегментами приходят корректные тексты, тайминги и preview-видео;
  - активный сегмент по умолчанию первый.
- Переключение сегментов:
  - draft текста и выбора видео не теряются при переходе между сегментами;
  - карусель корректно меняет центральный активный элемент.
- Видео-правки:
  - `AI-подбор` помечает только выбранный сегмент;
  - `Вернуть исходное` возвращает original source;
  - `Загрузить своё видео` меняет только выбранный сегмент.
- Текст-правки:
  - изменение текста одного сегмента после `Применить` меняет segment session;
  - при `Перегенерировать` итоговый combined text уходит в subtitles + voice по bot-логике.
- Коммит:
  - `Отмена` не меняет create-screen state;
  - `Применить` возвращает create-screen и включает режим `Перегенерировать`.
- Генерация:
  - `Перегенерировать` создаёт `video.edit`, а не `video.generate`;
  - проект обновляется как тот же `project_id`, а не создаёт новый entry случайно.
- Media:
  - segment preview работает и для direct URLs, и для источников, доступных только через proxy/API.
- Fallback:
  - если у проекта нет segment data или сегментов больше допустимого лимита, editor не открывается и показывает явное сообщение.

## Assumptions
- `v1` доступен только из текущего видео на вкладке `Создать`.
- `v1` повторяет семантику бота: один текст сегмента управляет и субтитрами, и озвучкой.
- `v1` работает только для проектов с 1-6 сегментами.
- UI сегментов — карусель из 3 видимых карточек, не сетка 6 в ряд.
- Prompt-панель не исчезает в другой экран, а преобразуется в нижнюю панель редактирования сегмента.
