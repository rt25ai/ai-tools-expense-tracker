export const repoBasePath =
  process.env.NODE_ENV === "production" ? "/ai-tools-expense-tracker" : "";

export function withBasePath(target: string) {
  return `${repoBasePath}${target.startsWith("/") ? target : `/${target}`}`;
}
