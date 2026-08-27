export const NEW_GAME_CONFIRM_MESSAGE = "Start a new game? Current picks will be cleared.";

export function shouldConfirmNewGame(filledCount: number): boolean {
  return filledCount > 0;
}

export function confirmNewGameIfNeeded(filledCount: number): boolean {
  if (!shouldConfirmNewGame(filledCount)) return true;
  return window.confirm(NEW_GAME_CONFIRM_MESSAGE);
}
