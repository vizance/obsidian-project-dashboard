"""用內建範例重拍 README 圖片；不啟動伺服器，也不存取網路。"""

from datetime import datetime
from math import ceil, floor
from pathlib import Path
import re
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
    'phone-month-view.png',
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

            def expand_all_quarters():
                folded = page.locator('#chart th.quarter.q-folded .quarter-toggle')
                while folded.count():
                    folded.first.click()

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
                elif area == 'phone':
                    page.locator('.month-title').hover()
                    elements = [page.locator('.controls'), page.locator('#chart table')]
                else:
                    page.locator('.month-title').hover()
                    elements = [page.locator('#chart table')]
                    if area == 'dashboard':
                        elements += [page.locator('.project-dashboard header'), page.locator('.controls')]
                    if popover:
                        elements += [page.locator(POPOVER)]

                # 版面太高時先擴大工作畫布；截圖仍只取內容外框。
                clip = content_clip([el.bounding_box() for el in elements], 0 if area == 'help' else 16)
                if area == 'phone':
                    # 表格可能在自己的範圍內上下捲動，手機畫布不跟著內容增高。
                    chart_box = page.locator('#chart').bounding_box()
                    table_box = page.locator('#chart table').bounding_box()
                    if chart_box is None or table_box is None:
                        raise RuntimeError('無法量測手機表格的裁切範圍')
                    clip = {
                        'x': 0, 'y': 0, 'width': 390,
                        'height': min(844, ceil(min(
                            chart_box['y'] + chart_box['height'],
                            table_box['y'] + table_box['height'],
                        ))),
                    }
                viewport = page.viewport_size
                assert viewport, '找不到截圖畫布'
                if area != 'phone' and clip['y'] + clip['height'] > viewport['height']:
                    page.set_viewport_size({
                        'width': viewport['width'],
                        'height': ceil(clip['y'] + clip['height']),
                    })
                    if area != 'phone':
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
                    # 說明面板只拍面板本身，後面的表格先藏起來，邊緣才不會透出表格的字。
                    style=(
                        '#chart, .controls, .project-dashboard header { visibility: hidden !important; }'
                        if area == 'help' else '#help-fab { visibility: hidden !important; }'
                    ),
                )

            step = '拍攝 2026 年視圖'
            open_demo()
            assert page.locator('#show-paused').locator('..').inner_text() == '顯示暫停（2）', '暫停專案數量不符'
            assert page.locator('#chart tbody tr').count() == 8, '預設可見專案數量不符'
            assert page.locator('.bar-overflow').count() > 0, '缺少超出結束日期的任務'
            assert '2026 年' in page.locator('.month-title').inner_text(), '年份不符'
            assert page.locator('th.quarter .quarter-toggle').all_text_contents() == [
                'Q1 ▸', 'Q2 ▸', 'Q3 ▸', 'Q4 ▾',
            ], '預設季標題或折疊狀態不符'
            weeks = page.locator('th.week')
            assert weeks.count() == 13, '預設週欄數量不符'
            assert weeks.first.inner_text() == 'W41', '預設第一週不是 W41'
            assert weeks.last.inner_text() == 'W53', '預設最後一週不是 W53'
            gaps = page.locator('#chart th.q-fold-gap')
            assert gaps.count() == 3, '折起的季沒有三個空白欄頭'
            folded_cells = page.locator('#chart td.q-fold-cell')
            assert folded_cells.count() == 3 * page.locator('#chart tbody tr').count(), '專案列的折疊窄欄數量不符'
            for element in gaps.all() + folded_cells.all():
                box = element.bounding_box()
                assert box is not None and abs(box['width'] - 40) <= 1, '折疊窄欄寬度不是 40 像素'
            assert folded_cells.locator('.bar').count() == 0, '折疊窄欄裡仍有色條'
            for week in weeks.all():
                box = week.bounding_box()
                assert box is not None and abs(box['width'] - 32) <= 1, '展開的週欄寬度不是 32 像素'
            assert page.locator('.month-nav').get_by_text('今年', exact=True).count() == 0, '年視圖仍有今年按鈕'
            this_week = page.locator('.month-nav button').filter(has_text=re.compile(r'^本週$'))
            assert this_week.count() == 1, '找不到唯一的本週按鈕'
            fit_year()
            page.wait_for_timeout(100)
            assert this_week.is_hidden(), '本週已在眼前時按鈕沒有隱藏'
            snapshot('year-view.png')

            step = '拍攝年視圖說明面板'
            page.locator('#help-fab').click()
            page.locator('#help-panel').wait_for(state='visible')
            assert page.get_by_role('tab', name='年視圖', exact=True).get_attribute('aria-selected') == 'true', '年視圖說明分頁未選中'
            assert '折起來的一季' in page.locator('#help-panel [role=tabpanel]:visible').inner_text(), '年視圖說明缺少折疊窄欄'
            snapshot('help-year.png', area='help')
            page.locator('#help-panel .close-btn').click()
            page.locator('#help-panel').wait_for(state='hidden')

            step = '年視圖的本週按鈕'
            expand_all_quarters()
            assert page.locator('th.week').count() == 53, '全部展開後週欄數量不是 53'
            year_width = page.locator('#chart').evaluate('''(chart) => {
                const project = chart.querySelector('th.proj-col');
                return project ? chart.scrollWidth - project.getBoundingClientRect().width : null;
            }''')
            if year_width is None or abs(year_width - 53 * 32) > 5:
                raise RuntimeError('全部展開後，全年週欄總寬不是 1,696 像素')
            page.set_viewport_size({'width': 1100, 'height': 900})
            page.locator('#chart').evaluate('(el) => { el.scrollLeft = 0; }')
            page.wait_for_timeout(100)
            assert this_week.is_visible(), '本週捲出畫面後按鈕沒有出現'
            assert this_week.get_attribute('title') == '捲到本週', '本週按鈕提示不符'
            this_week.click()
            page.wait_for_timeout(100)
            centers = page.evaluate('''() => {
                const chart = document.querySelector('#chart');
                const project = chart?.querySelector('th.proj-col');
                const weeks = chart?.querySelectorAll('th.week.today-week');
                if (!chart || !project || weeks?.length !== 1) return null;
                const chartBox = chart.getBoundingClientRect();
                const projectBox = project.getBoundingClientRect();
                const weekBox = weeks[0].getBoundingClientRect();
                if (chartBox.width <= 0 || projectBox.width <= 0 || weekBox.width <= 0
                    || projectBox.right >= chartBox.right) return null;
                return {
                    week: (weekBox.left + weekBox.right) / 2,
                    area: (projectBox.right + chartBox.right) / 2,
                    weekLeft: weekBox.left,
                    weekRight: weekBox.right,
                    areaLeft: projectBox.right,
                    areaRight: chartBox.right,
                    scrollLeft: chart.scrollLeft,
                    maxScroll: chart.scrollWidth - chart.clientWidth,
                };
            }''')
            if centers is None:
                raise RuntimeError('無法量測本週欄與表格可見範圍的中心')
            if centers['weekLeft'] < centers['areaLeft'] - 1 or centers['weekRight'] > centers['areaRight'] + 1:
                raise RuntimeError('按本週後，本週欄沒有完整在表格可見範圍內')
            # W47 離年底只剩幾週，捲到最右仍到不了正中間時，只要求捲到最右。
            at_end = centers['scrollLeft'] >= centers['maxScroll'] - 1 and centers['week'] > centers['area']
            if abs(centers['week'] - centers['area']) > 1 and not at_end:
                raise RuntimeError('本週欄與表格可見範圍的中心相差超過 1 像素，也沒有捲到最右')
            assert this_week.is_hidden(), '捲到本週後按鈕沒有隱藏'
            fit_year()

            step = '拍攝週浮窗'
            assert page.locator('#chart th.q-folded').count() == 0, '週浮窗截圖前仍有折起的季'
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
            assert page.locator('#chart th.q-folded').count() == 0, '暫停專案列截圖前仍有折起的季'
            snapshot('paused-rows.png', area='table')

            step = '拍攝編輯分類、狀態與暫停專案'
            page.locator('#edit-categories').check()
            assert page.locator('#chart tr.status-pending').count() == 2, '暫停專案未全部顯示'
            page.locator('.editing-categories .status-select').first.wait_for(state='visible')
            assert page.locator('#chart th.q-folded').count() == 0, '編輯分類截圖前仍有折起的季'
            snapshot('status-editing.png')

            step = '拍攝 2027 年視圖'
            page.locator('#edit-categories').uncheck()
            page.locator('#show-paused').uncheck()
            page.locator('.month-nav-btn[title="下一年"]').click()
            assert page.locator('.month-title').inner_text() == '2027 年', '無法切到 2027 年'
            assert page.locator('.bar.bar-solid[data-week^="2027-"]').count() > 0, '缺少跨年排程'
            fit_year()
            assert page.locator('th.quarter .quarter-toggle').all_text_contents() == [
                'Q1 ▾', 'Q2 ▾', 'Q3 ▾', 'Q4 ▾',
            ], '2027 年沒有展開四季'
            assert page.locator('#chart th.q-folded').count() == 0, '2027 年仍有折起的季'
            assert this_week.is_visible(), '2027 年沒有顯示本週按鈕'
            snapshot('year-2027.png')

            step = '拍攝行事曆設定'
            open_demo(settings=True)
            heading = calendar_heading()
            heading.evaluate('(el) => el.scrollIntoView({block: "start"})')
            assert page.locator('.pd-calendar-row').count() == 2, '行事曆設定數量不符'
            page.locator('button', has_text='Add a calendar').wait_for(state='visible')
            snapshot('settings-calendars.png', area='calendars')

            step = '拍攝手機月視圖'

            def open_phone(width, height=844):
                page.set_viewport_size({'width': width, 'height': height})
                page.goto(DEMO.as_uri() + '?mode=phone')
                page.wait_for_selector('#screenshot-root[data-ready="true"], #screenshot-root[data-error]')
                if page.locator('#screenshot-root[data-error]').count():
                    raise RuntimeError(page.locator('#screenshot-root').inner_text())
                page.evaluate('document.fonts.ready')
                assert page.locator('#screenshot-root').get_attribute('data-mode') == 'phone', '未開啟手機版面'
                assert page.locator('.month-title').inner_text() == '2026 年 11 月（W45–W49）', '手機月份或今天日期不符'
                assert page.locator('table.month-grid').get_attribute('data-weeks') == '5', '手機月份週數不符'

            def phone_geometry():
                return page.evaluate('''() => {
                    const bounds = (element) => {
                        const rect = element.getBoundingClientRect();
                        return {
                            left: rect.left, right: rect.right, width: rect.width,
                            top: rect.top, bottom: rect.bottom,
                        };
                    };
                    const chart = document.querySelector('#chart');
                    const todayHeaders = Array.from(document.querySelectorAll('th.month-week.mw-today'));
                    return {
                        chart: bounds(chart),
                        scrollWidth: chart.scrollWidth,
                        clientWidth: chart.clientWidth,
                        scrollTop: chart.scrollTop,
                        scrollHeight: chart.scrollHeight,
                        clientHeight: chart.clientHeight,
                        pageWidth: document.documentElement.scrollWidth,
                        project: bounds(document.querySelector('th.proj-col')),
                        weeks: Array.from(document.querySelectorAll('th.month-week'), bounds),
                        unscheduled: bounds(document.querySelector('th.month-unscheduled')),
                        todayCount: todayHeaders.length,
                        today: todayHeaders.map((header) => ({
                            ...bounds(header),
                            weekText: header.querySelector('.mw-week')?.textContent ?? '',
                            tagText: header.querySelector('.mw-today-tag')?.textContent ?? '',
                        })),
                    };
                }''')

            def require_inside(box, chart, message):
                if box['left'] < chart['left'] or box['right'] > chart['right']:
                    raise RuntimeError(message)

            def require_this_week_alignment(geometry):
                if geometry['todayCount'] != 1:
                    raise RuntimeError('手機月視圖的本週欄頭不是恰好一個')
                if abs(geometry['today'][0]['left'] - geometry['project']['right']) > 1:
                    raise RuntimeError('本週欄頭的左緣沒有貼著名稱欄的右緣')

            open_phone(390)
            geometry = phone_geometry()
            require_this_week_alignment(geometry)
            if not geometry['today'][0]['weekText'].strip().startswith('W47'):
                raise RuntimeError('本週欄頭的週數不是 W47')
            if geometry['today'][0]['tagText'] != '本週':
                raise RuntimeError('本週欄頭沒有標示本週')
            next_week = page.locator('th.month-week.mw-today + th.month-week')
            if next_week.count() != 1 or not next_week.evaluate(
                "(header) => (header.querySelector('.mw-week')?.textContent ?? '').trim().startsWith('W48')"
            ):
                raise RuntimeError('本週的下一欄不是 W48')
            require_inside(
                next_week.evaluate('''(header) => {
                    const rect = header.getBoundingClientRect();
                    return {left: rect.left, right: rect.right};
                }'''), geometry['chart'],
                '390 像素寬時，打開後 W48 沒有完整顯示',
            )
            if geometry['scrollTop'] != 0:
                raise RuntimeError('打開手機月視圖後，表格沒有停在最上面')
            names = page.locator('td.proj-cell .name')
            if names.count() == 0:
                raise RuntimeError('手機名稱欄沒有可檢查的專案名稱')
            if names.evaluate_all(r'(names) => names.some((name) => /^P-\d/.test(name.textContent.trim()))'):
                raise RuntimeError('手機名稱欄仍顯示 P-日期 代碼')

            page.locator('#chart').evaluate('(el) => { el.scrollLeft = 0; }')
            geometry = phone_geometry()
            if abs(geometry['project']['width'] - 96) > 1:
                raise RuntimeError('390 像素寬時，名稱欄寬度不是 96 像素')
            if len(geometry['weeks']) != 5:
                raise RuntimeError('手機月視圖沒有 5 個週欄')
            for week, box in zip(('W45', 'W46'), geometry['weeks'][:2]):
                require_inside(box, geometry['chart'], f'390 像素寬時，{week} 沒有完整顯示')
            if geometry['pageWidth'] > 390:
                raise RuntimeError('390 像素寬時，儀表板分頁本身會左右捲動')
            if geometry['scrollWidth'] <= geometry['clientWidth']:
                raise RuntimeError('390 像素寬時，表格無法左右滑動')

            page.locator('#chart').evaluate('(el) => { el.scrollLeft = el.scrollWidth; }')
            geometry = phone_geometry()
            require_inside(geometry['weeks'][-1], geometry['chart'], '捲到最右後，最後一週沒有完整顯示')
            require_inside(geometry['unscheduled'], geometry['chart'], '捲到最右後，還沒排欄沒有完整顯示')
            if abs(geometry['project']['left'] - geometry['chart']['left']) > 1:
                raise RuntimeError('捲到最右後，名稱欄沒有固定在左邊')
            page.locator('#chart').evaluate('(el) => { el.scrollLeft = 0; }')

            cells = page.locator('td.month-cell[data-path]')
            cell_index = cells.evaluate_all('''(cells) => {
                const chart = document.querySelector('#chart').getBoundingClientRect();
                const visible = cells.map((cell, index) => ({
                    index, rect: cell.getBoundingClientRect(),
                })).filter(({rect}) => rect.left >= chart.left && rect.right <= chart.right);
                visible.sort((a, b) => b.rect.right - a.rect.right);
                return visible.length ? visible[0].index : -1;
            }''')
            if cell_index < 0:
                raise RuntimeError('找不到完整顯示、可開啟浮窗的手機週格子')
            cells.nth(cell_index).click()
            popover = page.locator(POPOVER)
            popover.wait_for(state='visible')
            assert 'pd-popover-phone' in (popover.get_attribute('class') or '').split(), '浮窗未套用手機版面'
            box = popover.bounding_box()
            if box is None or box['x'] < 8 or box['x'] + box['width'] > 382:
                raise RuntimeError('手機浮窗的左右邊緣沒有各留至少 8 像素')
            page.locator('.month-title').click()
            popover.wait_for(state='hidden')

            # 還沒排浮窗的週按鈕在手機上也要好按。先把表格捲到最右再點，避免點擊時
            # 自動捲動把剛打開的浮窗關掉。
            page.evaluate("(() => { const chart = document.querySelector('#chart'); chart.scrollLeft = chart.scrollWidth; })()")
            page.wait_for_timeout(200)
            page.locator(UNSCHEDULED).click()
            popover.wait_for(state='visible')
            week_buttons = popover.locator('.wp-week-btn').all()
            if not week_buttons:
                raise RuntimeError('手機的還沒排浮窗沒有週按鈕')
            for week_button in week_buttons:
                button_box = week_button.bounding_box()
                if button_box is None or button_box['width'] < 44 or button_box['height'] < 44:
                    raise RuntimeError('手機的還沒排浮窗有週按鈕小於 44×44 像素')
            page.locator('.month-title').click()
            popover.wait_for(state='hidden')
            page.evaluate("document.querySelector('#chart').scrollLeft = 0")

            open_phone(390, 360)
            page.locator('#show-paused').check()
            geometry = phone_geometry()
            if geometry['scrollHeight'] <= geometry['clientHeight'] + 40:
                raise RuntimeError('表格不夠高，量不到表頭固定')
            page.locator('#chart').evaluate('(el) => { el.scrollTop = 120; }')
            page.wait_for_timeout(100)
            geometry = phone_geometry()
            if geometry['scrollTop'] <= 0:
                raise RuntimeError('表格沒有往下捲，量不到表頭固定')
            sticky = page.evaluate('''() => {
                const chart = document.querySelector('#chart').getBoundingClientRect();
                const controls = document.querySelector('.controls').getBoundingClientRect();
                const dashboard = document.querySelector('.project-dashboard');
                const isOnTop = (header) => {
                    const rect = header.getBoundingClientRect();
                    return document.elementFromPoint(
                        (rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2,
                    )?.closest('th') === header;
                };
                return {
                    chartTop: chart.top,
                    headerTops: Array.from(document.querySelectorAll('table.month-grid thead th'),
                        (header) => header.getBoundingClientRect().top),
                    controlsTop: controls.top,
                    controlsBottom: controls.bottom,
                    todayOnTop: isOnTop(document.querySelector('th.month-week.mw-today')),
                    projectOnTop: isOnTop(document.querySelector('th.proj-col')),
                    dashboardScrollTop: dashboard.scrollTop,
                    dashboardScrollHeight: dashboard.scrollHeight,
                    dashboardClientHeight: dashboard.clientHeight,
                };
            }''')
            if not sticky['headerTops'] or any(abs(top - sticky['chartTop']) > 1 for top in sticky['headerTops']):
                raise RuntimeError('往下捲後，有表頭沒有固定在表格最上面')
            if sticky['controlsBottom'] > sticky['chartTop'] + 1 or sticky['controlsTop'] < 0:
                raise RuntimeError('往下捲後，月份控制列沒有留在表格上方')
            if not sticky['todayOnTop'] or not sticky['projectOnTop']:
                raise RuntimeError('往下捲後，本週或名稱欄的表頭沒有蓋在資料列上面')
            if sticky['dashboardScrollTop'] != 0 or sticky['dashboardScrollHeight'] > sticky['dashboardClientHeight'] + 1:
                raise RuntimeError('手機儀表板分頁本身會上下捲動')
            open_phone(390)

            open_phone(800)
            geometry = phone_geometry()
            if geometry['scrollWidth'] > geometry['clientWidth'] + 1:
                raise RuntimeError('800 像素寬時，整個月仍需要左右滑動')
            if len(geometry['weeks']) != 5:
                raise RuntimeError('800 像素寬時，手機月視圖沒有 5 個週欄')
            for index, box in enumerate(geometry['weeks'], start=45):
                require_inside(box, geometry['chart'], f'800 像素寬時，W{index} 沒有完整顯示')
            require_inside(geometry['unscheduled'], geometry['chart'], '800 像素寬時，還沒排欄沒有完整顯示')
            widths = [box['width'] for box in geometry['weeks']]
            if max(widths) - min(widths) > 1:
                raise RuntimeError('800 像素寬時，每週欄寬相差超過 1 像素')

            open_phone(390)
            require_this_week_alignment(phone_geometry())
            if page.locator(POPOVER).count():
                raise RuntimeError('手機截圖前浮窗尚未關閉')
            snapshot('phone-month-view.png', area='phone')
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
