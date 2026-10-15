import type { AuthUser } from "@/types/auth";

export function UserAvatar({ user, size = "md" }: { user: Pick<AuthUser, "fullName" | "profilePhotoUrl">; size?: "sm" | "md" | "lg" }) {
  const initials = user.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const classes = size === "lg" ? "h-20 w-20 text-xl" : size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
  const src = user.profilePhotoUrl ? (user.profilePhotoUrl.startsWith("data:") ? user.profilePhotoUrl : `${import.meta.env.VITE_API_BASE_URL ?? ""}${user.profilePhotoUrl}`) : undefined;
  return src ? <img src={src} alt={`${user.fullName} profile`} className={`${classes} rounded-full object-cover`} /> : <span aria-label={`${user.fullName} initials`} className={`${classes} flex items-center justify-center rounded-full bg-laupay-amber-soft font-semibold text-laupay-indigo`}>{initials || "?"}</span>;
}
