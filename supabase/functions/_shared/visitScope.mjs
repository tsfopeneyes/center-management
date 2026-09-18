function explicitScope(text) {
  const haifn = /하이픈|haifn|강동/i.test(text);
  const enough = /이높플레이스|이높|enough[ _-]?place|강서/i.test(text);
  if (/하이픈\s*만|haifn\s*만/i.test(text)) return "하이픈";
  if (/이높(?:플레이스)?\s*만|enough[ _-]?place\s*만/i.test(text)) return "이높플레이스";
  if (/전체\s*센터|모든\s*센터|두\s*센터|양쪽\s*센터|두\s*지점|센터\s*전체/i.test(text) || (haifn && enough)) return "";
  if (haifn) return "하이픈";
  if (enough) return "이높플레이스";
  return null;
}

export function resolveVisitLocationKeyword(question, threadContext, requested) {
  const direct = explicitScope(question);
  if (direct !== null) return direct;

  // Short follow-ups inherit the last center named by the requester, not by the bot.
  if (/^(?:응\s*)?(?:다시|재조회|그럼|그러면|그래|그것|그거|왜|확인)/.test(question.trim())) {
    const requesterMessages = threadContext.split("\n")
      .filter((line) => line.startsWith("요청자:"))
      .map((line) => line.slice("요청자:".length).trim());
    for (const message of requesterMessages.reverse()) {
      const inherited = explicitScope(message);
      if (inherited !== null) return inherited;
    }
  }
  return typeof requested === "string" ? requested.trim() : "";
}
