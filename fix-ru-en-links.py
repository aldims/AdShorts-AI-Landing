#!/usr/bin/env python3
"""Update Russian pages' links to EN versions with new English slugs."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))

MAPPING = {
    'analitika-youtube-shorts-kak-chitat': 'youtube-shorts-analytics-how-to-read',
    'avtorskie-prava-v-shorts': 'youtube-shorts-copyright',
    'bitreyt-dlya-shorts': 'youtube-shorts-bitrate',
    'cta-v-shorts': 'cta-in-youtube-shorts',
    'ctr-v-shorts': 'ctr-in-youtube-shorts',
    'fon-dlya-shorts': 'background-for-youtube-shorts',
    'format-video-dlya-shorts': 'video-format-for-youtube-shorts',
    'gromkost-golosa-i-muzyki-v-shorts': 'voice-and-music-volume-in-shorts',
    'heshtegi-dlya-shorts-rabotayut-li': 'do-hashtags-work-for-youtube-shorts',
    'idei-dlya-shorts-gde-brat': 'youtube-shorts-ideas-where-to-find',
    'kak-analizirovat-uderzhanie-v-shorts': 'how-to-analyze-retention-in-shorts',
    'kak-chasto-vykladyvat-shorts': 'how-often-to-post-youtube-shorts',
    'kak-naiti-heshtegi-dlya-shorts': 'how-to-find-hashtags-for-shorts',
    'kak-napisat-scenariy-dlya-shorts': 'how-to-write-a-script-for-shorts',
    'kak-podnyat-uderzhanie-v-shorts': 'how-to-increase-retention-in-shorts',
    'kak-popast-v-rekomendacii-youtube-shorts': 'how-to-get-into-youtube-shorts-recommendations',
    'kak-postavit-oblozhku-na-shorts': 'how-to-set-a-thumbnail-on-shorts',
    'kak-privesti-trafik-iz-shorts-na-sayt': 'how-to-drive-traffic-from-shorts-to-website',
    'kak-privesti-trafik-iz-shorts-v-telegram': 'how-to-drive-traffic-from-shorts-to-telegram',
    'kak-prodavat-cherez-shorts': 'how-to-sell-with-youtube-shorts',
    'kak-sdelat-chistyy-zvuk-v-shorts': 'how-to-get-clean-audio-in-shorts',
    'kak-sdelat-dinamichnyj-temp-v-shorts': 'how-to-create-dynamic-pacing-in-shorts',
    'kak-sdelat-huk-v-shorts': 'how-to-create-a-hook-in-shorts',
    'kak-sdelat-koncovku-v-shorts': 'how-to-create-an-ending-in-shorts',
    'kak-sdelat-petlyu-v-shorts': 'how-to-create-a-loop-in-shorts',
    'kak-sdelat-povorot-v-seredine-shorts': 'how-to-add-a-mid-video-twist-in-shorts',
    'kak-sdelat-seriyu-shorts': 'how-to-make-a-youtube-shorts-series',
    'kak-sdelat-shorts-bez-montazha': 'how-to-make-shorts-without-editing',
    'kak-sdelat-shorts-chtoby-dosmotreli-do-konca': 'how-to-make-shorts-people-watch-to-the-end',
    'kak-sdelat-shorts-iz-dlinnogo-video': 'how-to-make-shorts-from-a-long-video',
    'kak-sdelat-shorts-iz-teksta': 'how-to-turn-text-into-shorts',
    'kak-sdelat-shorts-na-youtube': 'how-to-make-shorts-on-youtube',
    'kak-sdelat-tekst-na-video-dlya-shorts': 'on-screen-text-for-youtube-shorts',
    'kak-snimat-shorts-na-telefon': 'how-to-film-shorts-on-a-phone',
    'kak-snimat-shorts-pachkoy': 'how-to-batch-film-shorts',
    'kak-testirovat-shorts': 'how-to-test-youtube-shorts',
    'kak-ubrat-tryasku-v-shorts': 'how-to-remove-shake-in-shorts',
    'kak-uskorit-montazh-shorts': 'how-to-speed-up-shorts-editing',
    'kak-vybrat-nishu-dlya-shorts': 'how-to-choose-a-niche-for-shorts',
    'kak-zagruzit-shorts': 'how-to-upload-youtube-shorts',
    'kak-zakrepit-kommentarij-v-shorts': 'how-to-pin-a-comment-in-shorts',
    'klyuchevye-slova-dlya-shorts': 'keywords-for-youtube-shorts',
    'kogda-vykladyvat-shorts': 'when-to-post-youtube-shorts',
    'kontent-plan-dlya-shorts-na-mesyac': 'youtube-shorts-content-plan-for-a-month',
    'monetizaciya-youtube-shorts': 'youtube-shorts-monetization',
    'muzyka-bez-avtorskih-prav-dlya-shorts': 'copyright-free-music-for-shorts',
    'muzyka-dlya-shorts': 'music-for-youtube-shorts',
    'neyroset-dlya-shorts': 'ai-for-youtube-shorts',
    'nizkoe-uderzhanie-v-youtube-shorts': 'low-retention-on-youtube-shorts',
    'oblozhka-dlya-shorts': 'youtube-shorts-thumbnail',
    'opisanie-dlya-shorts-chto-pisat': 'youtube-shorts-description-what-to-write',
    'optimalnaya-dlina-shorts': 'optimal-youtube-shorts-length',
    'ozvuchka-dlya-shorts-kak-vybrat-golos': 'voiceover-for-shorts-how-to-choose-a-voice',
    'perehody-v-shorts': 'transitions-in-youtube-shorts',
    'povtoryayushchiysya-kontent-shorts': 'reused-content-on-youtube-shorts',
    'procent-prolistyvaniy-shorts': 'youtube-shorts-swipe-away-rate',
    'prosmotry-shorts-upali': 'youtube-shorts-views-dropped',
    'razreshenie-dlya-shorts': 'youtube-shorts-resolution',
    'shablony-dlya-shorts': 'youtube-shorts-templates',
    'shorts-0-prosmotrov': 'youtube-shorts-getting-0-views',
    'shorts-bez-lica': 'faceless-youtube-shorts',
    'shorts-chernye-polosy': 'youtube-shorts-black-bars',
    'shorts-dlya-biznesa': 'youtube-shorts-for-business',
    'shorts-dlya-internet-magazina': 'youtube-shorts-for-online-store',
    'shorts-dlya-it-kompanii': 'youtube-shorts-for-it-company',
    'shorts-dlya-kliniki': 'youtube-shorts-for-clinic',
    'shorts-dlya-nedvizhimosti': 'youtube-shorts-for-real-estate',
    'shorts-dlya-onlayn-shkoly': 'youtube-shorts-for-online-school',
    'shorts-dlya-smm-agentstva': 'youtube-shorts-for-smm-agency',
    'shorts-dlya-yuristov': 'youtube-shorts-for-lawyers',
    'shorts-iz-foto': 'youtube-shorts-from-photos',
    'shorts-malo-kommentariev': 'youtube-shorts-few-comments',
    'shorts-malo-laykov': 'youtube-shorts-few-likes',
    'shorts-ne-konvertiruyut-v-podpischiki': 'youtube-shorts-not-converting-to-subscribers',
    'shorts-ne-nabirayut-prosmotry': 'youtube-shorts-not-getting-views',
    'shorts-ne-otobrazhayutsya-na-kanale': 'youtube-shorts-not-showing-on-channel',
    'shorts-ne-prohodyat-moderaciyu': 'youtube-shorts-not-passing-moderation',
    'shorts-ne-zagruzhayutsya': 'youtube-shorts-wont-upload',
    'shorts-net-zvuka': 'youtube-shorts-no-sound',
    'shorts-nizkoe-kachestvo-video': 'youtube-shorts-low-video-quality',
    'shorts-smotryat-bez-zvuka': 'watching-youtube-shorts-without-sound',
    'shorts-tenevoy-ban': 'youtube-shorts-shadowban',
    'shorts-zavisayut-na-obrabotke': 'youtube-shorts-stuck-processing',
    'skolko-stoit-montazh-shorts': 'how-much-does-shorts-editing-cost',
    'ssylka-v-shorts-kak-dobavit': 'how-to-add-a-link-in-shorts',
    'storitelling-v-shorts': 'storytelling-in-youtube-shorts',
    'subtitry-dlya-shorts-avtomatom': 'automatic-subtitles-for-youtube-shorts',
    'svet-dlya-shorts': 'lighting-for-youtube-shorts',
    'vozrastnoe-ogranichenie-shorts': 'youtube-shorts-age-restriction',
    'zagolovok-dlya-shorts-kak-pisat': 'youtube-shorts-title-how-to-write',
}


def replace_en_slugs_in_ru_page(content):
    """Replace old EN slug references in a Russian page."""
    for old, new in MAPPING.items():
        # hreflang="en" absolute URLs
        content = content.replace(
            f'adshortsai.com/en/{old}/',
            f'adshortsai.com/en/{new}/'
        )
        # Relative lang-switch links: href="../en/OLD/"
        content = content.replace(
            f'href="../en/{old}/',
            f'href="../en/{new}/'
        )
    return content


def main():
    updated = 0
    errors = 0

    # Process each Russian guide page (root-level directories matching old slugs)
    print('=== Phase 1: Updating Russian guide pages ===')
    for old_slug in MAPPING.keys():
        filepath = os.path.join(BASE, old_slug, 'index.html')
        if os.path.isfile(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            new_content = replace_en_slugs_in_ru_page(content)
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                updated += 1
        else:
            print(f'  WARNING: Not found: {filepath}')
            errors += 1
    print(f'  Updated {updated} Russian guide pages')

    # Also update the Russian shorts-guides index
    print('\n=== Phase 2: Updating Russian shorts-guides index ===')
    ru_guides_index = os.path.join(BASE, 'shorts-guides', 'index.html')
    if os.path.isfile(ru_guides_index):
        with open(ru_guides_index, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = replace_en_slugs_in_ru_page(content)
        if new_content != content:
            with open(ru_guides_index, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print('  Updated shorts-guides/index.html')
        else:
            print('  No changes needed')
    else:
        print('  WARNING: shorts-guides/index.html not found')

    # Update Russian main page index.html
    print('\n=== Phase 3: Updating Russian main page ===')
    ru_main = os.path.join(BASE, 'index.html')
    if os.path.isfile(ru_main):
        with open(ru_main, 'r', encoding='utf-8') as f:
            content = f.read()
        new_content = replace_en_slugs_in_ru_page(content)
        if new_content != content:
            with open(ru_main, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print('  Updated index.html')
        else:
            print('  No changes needed')

    # Verification
    print('\n=== Phase 4: Verification ===')
    verify_errors = 0
    for old_slug in MAPPING.keys():
        filepath = os.path.join(BASE, old_slug, 'index.html')
        if os.path.isfile(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for old in MAPPING.keys():
                if f'adshortsai.com/en/{old}/' in content:
                    print(f'  OLD hreflang in {old_slug}: adshortsai.com/en/{old}/')
                    verify_errors += 1
                if f'href="../en/{old}/' in content:
                    print(f'  OLD lang-switch in {old_slug}: href="../en/{old}/"')
                    verify_errors += 1

    if verify_errors == 0:
        print('  All checks passed!')
    else:
        print(f'  {verify_errors} errors found')

    print(f'\nDone! Updated {updated} Russian pages.')


if __name__ == '__main__':
    main()
