"""用內建範例重拍 README 圖片；不啟動伺服器，也不存取網路。"""

from datetime import datetime
from math import ceil, floor
from pathlib import Path
import shutil
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
DEMO = ROOT / 'scripts/screenshots/dist/index.html'
IMAGES = ROOT / 'docs/images'
COURSE_PATH = 'Projects/🚧 P-20260901 範例線上課程製作.md'
COURSE_WEEK = (
    f'.bar.bar-solid[data-path="{COURSE_PATH}"][data-week="2026-W47"]'
)
UNSCHEDULED = f'td.month-unscheduled[data-path="{COURSE_PATH}"]'
POPOVER = '.pd-week-popover:not([hidden])'
NAMES = (
    'year-view.png',
    'week-popover.png',
    'help-year.png',
    'help-month.png',
    'month-view.png',
    'unscheduled-popover.png',
    'status-editing.png',
    'paused-rows.png',
    'year-2027.png',
    'settings-calendars.png',
)


def content_clip(boxes, bottom_padding=16):
    """合併內容與浮窗範圍，向外取整，保留下緣留白。"""
    if not boxes or any(box is None for box in boxes):
        raise ValueError('無法量測截圖內容')
    left = floor(min(box['x'] for box in boxes))
    top = floor(min(box['y'] for box in boxes))
    right = ceil(max(box['x'] + box['width'] for box in boxes))
    bottom = ceil(max(box['y'] + box['height'] for box in boxes)) + bottom_padding
    return {'x': left, 'y': top, 'width': right - left, 'height': bottom - top}


def capture():
    if not DEMO.is_file():
        print('找不到展示頁，請先在專案根目錄執行 npm run screenshots:build。', file=sys.stderr)
        return 1
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            '找不到 Python Playwright。請安裝 playwright==1.63.0，'
            '再執行 python3 -m playwright install chromium。',
            file=sys.stderr,
        )
        return 1

    # 全部拍好並驗證後才複製到文件，失敗時保留原有的整組圖片。
    staging = Path(tempfile.mkdtemp(prefix='project-dashboard-screenshots-'))
    errors = []
    blocked = []
    step = '啟動 Chromium'
    published = 0
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                args=['--disable-background-networking', '--disable-component-update'],
            )
            context = browser.new_context(
                viewport={'width': 1440, 'height': 900},
                device_scale_factor=2,
                timezone_id='Asia/Taipei',
                locale='zh-TW',
                color_scheme='light',
                reduced_motion='reduce',
                offline=True,
            )

            def local_only(route):
                if route.request.url.startswith('file:'):
                    route.continue_()
                else:
                    blocked.append(route.request.url)
                    route.abort()

            context.route('**/*', local_only)
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            fixed = datetime.fromisoformat('2026-11-20T10:00:00+08:00')
            page.clock.install(time=fixed)
            page.clock.set_fixed_time(fixed)

            def open_demo(settings=False):
                page.set_viewport_size({'width': 1440, 'height': 900})
                page.goto(DEMO.as_uri() + ('?mode=settings' if settings else ''))
                page.wait_for_selector('#screenshot-root[data-ready="true"], #screenshot-root[data-error]')
                if page.locator('#screenshot-root[data-error]').count():
                    raise RuntimeError(page.locator('#screenshot-root').inner_text())
                page.evaluate('document.fonts.ready')
                if not settings:
                    assert '2026-11-20' in page.locator('.meta').inner_text(), '今天日期未固定'

            def fit_year():
                # 真正的年表固定每週 32 px；依原尺寸擴大畫布，全年才不會被裁切。
                width = page.locator('#chart').evaluate('(el) => Math.ceil(el.scrollWidth) + 2')
                page.set_viewport_size({'width': max(1440, width), 'height': 900})
                page.locator('#chart').evaluate('(el) => { el.scrollLeft = 0; }')
                assert page.locator('#chart').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), '年表仍超出截圖寬度'

            def calendar_heading():
                return page.locator('.setting-item-heading').filter(
                    has=page.locator('.setting-item-name', has_text='Calendars')
                )

            def snapshot(name, popover=False, area='dashboard'):
                if errors:
                    raise RuntimeError('展示頁執行錯誤：' + '; '.join(errors))
                if blocked:
                    raise RuntimeError('展示頁嘗試讀取非本機資源')
                if popover:
                    page.locator(POPOVER).wait_for(state='visible')
                else:
                    assert page.locator(POPOVER).count() == 0, '浮窗尚未關閉'

                if area == 'calendars':
                    page.locator('.setting-item-name', has_text='Calendars').hover()
                    elements = [calendar_heading().locator('.setting-item-info')]
                    elements += page.locator('.pd-calendar-row').all()
                    elements += [page.get_by_role('button', name='Add a calendar', exact=True)]
                elif area == 'help':
                    page.locator('#help-panel [role=tab][aria-selected=true]').hover()
                    elements = [page.locator('#help-panel')]
                else:
                    page.locator('.month-title').hover()
                    elements = [page.locator('#chart table')]
                    if area == 'dashboard':
                        elements += [page.locator('.project-dashboard header'), page.locator('.controls')]
                    if popover:
                        elements += [page.locator(POPOVER)]

                # 版面太高時先擴大工作畫布；截圖仍只取內容外框。
                clip = content_clip([el.bounding_box() for el in elements], 0 if area == 'help' else 16)
                viewport = page.viewport_size
                assert viewport, '找不到截圖畫布'
                if clip['y'] + clip['height'] > viewport['height']:
                    page.set_viewport_size({
                        'width': viewport['width'],
                        'height': ceil(clip['y'] + clip['height']),
                    })
                    clip = content_clip([el.bounding_box() for el in elements], 0 if area == 'help' else 16)
                viewport = page.viewport_size
                assert (
                    clip['x'] >= 0 and clip['y'] >= 0
                    and clip['x'] + clip['width'] <= viewport['width']
                    and clip['y'] + clip['height'] <= viewport['height']
                ), '內容超出截圖畫布'
                page.screenshot(
                    path=str(staging / name),
                    clip=clip,
                    animations='disabled',
                    style='' if area == 'help' else '#help-fab { visibility: hidden !important; }',
                )

            step = '拍攝 2026 年視圖'
            open_demo()
            assert page.locator('#show-paused').locator('..').inner_text() == '顯示暫停（2）', '暫停專案數量不符'
            assert page.locator('#chart tbody tr').count() == 8, '預設可見專案數量不符'
            assert page.locator('.bar-overflow').count() > 0, '缺少超出結束日期的任務'
            assert '2026 年' in page.locator('.month-title').inner_text(), '年份不符'
            fit_year()
            snapshot('year-view.png')

            step = '拍攝年視圖說明面板'
            page.locator('#help-fab').click()
            page.locator('#help-panel').wait_for(state='visible')
            assert page.get_by_role('tab', name='年視圖', exact=True).get_attribute('aria-selected') == 'true', '年視圖說明分頁未選中'
            snapshot('help-year.png', area='help')
            page.locator('#help-panel .close-btn').click()
            page.locator('#help-panel').wait_for(state='hidden')

            step = '拍攝週浮窗'
            page.locator(COURSE_WEEK).click()
            page.locator(f'{POPOVER} .wp-row').first.wait_for()
            assert page.locator(f'{POPOVER} .wp-check:checked').count() > 0, '缺少完成的任務'
            assert page.locator(f'{POPOVER} .wp-check:not(:checked)').count() > 0, '缺少未完成的任務'
            snapshot('week-popover.png', popover=True)

            step = '拍攝 2026 年 11 月月視圖'
            page.locator('.scale-option[title="月視圖"]').click()
            page.set_viewport_size({'width': 1440, 'height': 900})
            page.locator('.month-grid .general-row').wait_for()
            assert '2026 年 11 月' in page.locator('.month-title').inner_text(), '月份不符'
            assert set(page.locator('td.general-cell .gc-label').all_text_contents()) == {'工作', '家庭'}, '缺少行事曆名稱標籤'
            assert page.locator('.mc-overdue').count() > 0, '缺少逾期任務'
            snapshot('month-view.png')

            step = '拍攝月視圖說明面板'
            page.locator('#help-fab').click()
            page.locator('#help-panel').wait_for(state='visible')
            assert page.get_by_role('tab', name='月視圖', exact=True).get_attribute('aria-selected') == 'true', '月視圖說明分頁未選中'
            snapshot('help-month.png', area='help')
            page.locator('#help-panel .close-btn').click()
            page.locator('#help-panel').wait_for(state='hidden')

            step = '拍攝還沒排浮窗'
            assert page.locator(UNSCHEDULED).inner_text() == '2', '還沒排數量不符'
            page.locator(UNSCHEDULED).click()
            page.locator(f'{POPOVER} .wp-week-btn').first.wait_for()
            snapshot('unscheduled-popover.png', popover=True)

            step = '拍攝暫停專案列'
            page.locator('.scale-option[title="年視圖"]').click()
            fit_year()
            page.locator('#show-paused').check()
            assert not page.locator('#edit-categories').is_checked(), '暫停列截圖不應開啟編輯'
            assert page.locator('#chart tr.status-pending').count() == 2, '暫停專案未全部顯示'
            assert page.locator('#chart tr.status-pending .bar-solid[data-week^="2026-"]').count() > 0, '暫停專案缺少年度任務'
            snapshot('paused-rows.png', area='table')

            step = '拍攝編輯分類、狀態與暫停專案'
            page.locator('#edit-categories').check()
            assert page.locator('#chart tr.status-pending').count() == 2, '暫停專案未全部顯示'
            page.locator('.editing-categories .status-select').first.wait_for(state='visible')
            snapshot('status-editing.png')

            step = '拍攝 2027 年視圖'
            page.locator('#edit-categories').uncheck()
            page.locator('#show-paused').uncheck()
            page.locator('.month-nav-btn[title="下一年"]').click()
            assert page.locator('.month-title').inner_text() == '2027 年', '無法切到 2027 年'
            assert page.locator('.bar.bar-solid[data-week^="2027-"]').count() > 0, '缺少跨年排程'
            fit_year()
            snapshot('year-2027.png')

            step = '拍攝行事曆設定'
            open_demo(settings=True)
            heading = calendar_heading()
            heading.evaluate('(el) => el.scrollIntoView({block: "start"})')
            assert page.locator('.pd-calendar-row').count() == 2, '行事曆設定數量不符'
            page.locator('button', has_text='Add a calendar').wait_for(state='visible')
            snapshot('settings-calendars.png', area='calendars')
            browser.close()

        for name in NAMES:
            data = (staging / name).read_bytes()
            assert data.startswith(b'\x89PNG\r\n\x1a\n'), f'{name} 不是 PNG'
        IMAGES.mkdir(parents=True, exist_ok=True)
        for name in NAMES:
            shutil.copyfile(staging / name, IMAGES / name)
            published += 1
        print(f'已更新 docs/images/ 的 {len(NAMES)} 張範例截圖。')
        return 0
    except Exception as error:
        message = str(error)
        if "Executable doesn't exist" in message:
            print('找不到 Chromium，請先執行 python3 -m playwright install chromium。', file=sys.stderr)
        else:
            print(f'{step}失敗：{message}', file=sys.stderr)
        if published:
            print(f'已更新 {published} 張圖片，請修正錯誤後重跑，完成整組圖片。', file=sys.stderr)
        else:
            print('本次沒有發布圖片。', file=sys.stderr)
        print(f'暫存位置：{staging}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(capture())
