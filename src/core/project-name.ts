export function shortProjectName(name: string): string {
	// 規則取自實際專案名稱的日期寫法；代碼後必須還有名稱，才不會把整個名稱藏掉。
	return name.replace(/^P-\d{4}[\d.-]*(?:Q[1-4])?(?:\s*[~～&]\s*\d[\d.-]*(?:Q[1-4])?)*\s+(?=[^\s~～&])/, '');
}
