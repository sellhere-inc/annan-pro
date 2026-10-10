export async function enableWebPush(): Promise<string> { throw new Error('Web push requires a browser.'); }
export async function restoreWebPush(): Promise<boolean> { return false; }
export async function unregisterWebPush(): Promise<void> {}
