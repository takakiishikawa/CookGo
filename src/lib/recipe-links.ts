export function youtubeSearchUrl(title: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    title + " 作り方",
  )}`;
}

export function sourceLinkProps(sourceUrl: string | null | undefined) {
  return { href: sourceUrl ?? undefined, disabled: !sourceUrl };
}
