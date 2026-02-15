#!/usr/bin/env python3
"""Rename EN guide slugs from Russian transliteration to English SEO-friendly URLs."""

import os

BASE = os.path.dirname(os.path.abspath(__file__))
EN_DIR = os.path.join(BASE, 'en')

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


def replace_slugs_in_content(content):
    """Replace all old EN slugs with new ones in file content."""
    for old, new in MAPPING.items():
        # Replace absolute EN URLs (canonical, og:url, hreflang="en", schema @id, sitemap)
        content = content.replace(
            f'adshortsai.com/en/{old}/',
            f'adshortsai.com/en/{new}/'
        )
        # Replace relative links between EN guide pages (cross-references)
        content = content.replace(
            f'href="../{old}/',
            f'href="../{new}/'
        )
    return content


def process_file(filepath):
    """Read, replace slugs, and write back a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    updated = replace_slugs_in_content(content)
    if updated != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(updated)
        return True
    return False


def main():
    # Phase 1: Rename directories
    print('=== Phase 1: Renaming directories ===')
    renamed = 0
    for old, new in MAPPING.items():
        old_path = os.path.join(EN_DIR, old)
        new_path = os.path.join(EN_DIR, new)
        if os.path.isdir(old_path):
            os.rename(old_path, new_path)
            renamed += 1
        elif os.path.isdir(new_path):
            print(f'  Already renamed: {old} -> {new}')
        else:
            print(f'  WARNING: Directory not found: {old}')
    print(f'  Renamed {renamed} directories')

    # Phase 2: Update HTML in each guide page
    print('\n=== Phase 2: Updating guide pages ===')
    updated_guides = 0
    for new_slug in MAPPING.values():
        filepath = os.path.join(EN_DIR, new_slug, 'index.html')
        if os.path.isfile(filepath):
            if process_file(filepath):
                updated_guides += 1
        else:
            print(f'  WARNING: File not found: {filepath}')
    print(f'  Updated {updated_guides} guide pages')

    # Phase 3: Update shorts-guides index
    print('\n=== Phase 3: Updating shorts-guides index ===')
    guides_index = os.path.join(EN_DIR, 'shorts-guides', 'index.html')
    if process_file(guides_index):
        print('  Updated shorts-guides/index.html')
    else:
        print('  No changes needed in shorts-guides/index.html')

    # Phase 4: Update sitemap.xml
    print('\n=== Phase 4: Updating sitemap.xml ===')
    sitemap = os.path.join(BASE, 'sitemap.xml')
    if os.path.isfile(sitemap):
        if process_file(sitemap):
            print('  Updated sitemap.xml')
        else:
            print('  No changes needed in sitemap.xml')
    else:
        print('  WARNING: sitemap.xml not found')

    # Phase 5: Verification
    print('\n=== Phase 5: Verification ===')
    errors = 0

    # Check all new directories exist
    for new_slug in MAPPING.values():
        if not os.path.isdir(os.path.join(EN_DIR, new_slug)):
            print(f'  MISSING directory: en/{new_slug}')
            errors += 1

    # Check no old directories remain
    for old_slug in MAPPING.keys():
        if os.path.isdir(os.path.join(EN_DIR, old_slug)):
            print(f'  OLD directory still exists: en/{old_slug}')
            errors += 1

    # Check no old EN slugs remain in HTML files
    for new_slug in MAPPING.values():
        filepath = os.path.join(EN_DIR, new_slug, 'index.html')
        if os.path.isfile(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            for old in MAPPING.keys():
                if f'adshortsai.com/en/{old}/' in content:
                    print(f'  OLD slug reference in {new_slug}: adshortsai.com/en/{old}/')
                    errors += 1
                if f'href="../{old}/' in content:
                    print(f'  OLD relative link in {new_slug}: href="../{old}/"')
                    errors += 1

    # Check shorts-guides index
    with open(guides_index, 'r', encoding='utf-8') as f:
        content = f.read()
    for old in MAPPING.keys():
        if f'href="../{old}/' in content:
            print(f'  OLD link in shorts-guides: href="../{old}/"')
            errors += 1

    if errors == 0:
        print('  All checks passed!')
    else:
        print(f'  {errors} errors found')

    print(f'\nDone! Renamed {renamed} dirs, updated {updated_guides} guide pages.')


if __name__ == '__main__':
    main()
