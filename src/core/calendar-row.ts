import { addDaysISO, mondayOfWeek } from './weeks';

/**
 * General 列狀態列需要的讀取狀態。形狀與 `CalendarStore` 的 `state` 相符，但這裡
 * 自己定義，核心邏輯才不用認識讀取器本身。
 */
export interface CalendarFetchStatus {
	running: boolean;
	started: boolean;
	finishedAt: string | null;
	failures: readonly { displayName: string; reason: string }[];
}

/**
 * 狀態列要顯示的文字與提示。`tooltip` 是空字串時不要設 `title` 屬性，滑過去才
 * 不會跳出空的提示框。
 */
export interface CalendarStatusLine {
	text: string;
	tooltip: string;
}

const RUNNING_TEXT = '讀取中…';

/**
 * 狀態列的文字（dashboard-calendar-row：General row in the month view）。
 * 提示只列出行事曆的顯示名稱與原因，絕不含連結。
 */
export function calendarStatusLine(status: CalendarFetchStatus): CalendarStatusLine {
	// 這次外掛執行期間還沒開始讀取前是空的。
	if (!status.started) return { text: '', tooltip: '' };
	if (status.running) return { text: RUNNING_TEXT, tooltip: '' };
	// 開始過卻沒有結束時間，只會是讀取被丟棄（外掛卸載）的情況，當成還沒讀過。
	if (status.finishedAt === null) return { text: '', tooltip: '' };
	const text = `更新於 ${status.finishedAt}`;
	if (status.failures.length === 0) return { text, tooltip: '' };
	return {
		text: `${text}・⚠ ${status.failures.length} 個行事曆讀不到`,
		tooltip: status.failures.map((failure) => `${failure.displayName}：${failure.reason}`).join('\n'),
	};
}

/**
 * 顯示中那個月要展開的時間範圍：第一週的週一到最後一週的下一個週一（本地時間）。
 * 週列表是空的時候回傳 null，呼叫端就不畫 General 列。
 */
export function monthEventRange(weekLabels: readonly string[]): { from: string; to: string } | null {
	const first = weekLabels[0];
	const last = weekLabels[weekLabels.length - 1];
	if (first === undefined || last === undefined) return null;
	return { from: mondayOfWeek(first), to: addDaysISO(mondayOfWeek(last), 7) };
}
