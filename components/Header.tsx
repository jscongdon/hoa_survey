import Image from "next/image";

export default function Header() {
  return (
    <header
      className="w-full py-4 flex items-center justify-between mb-8 px-4 sm:px-6 lg:px-8"
      style={{ borderBottom: "1px solid rgba(var(--muted)/0.12)" }}
    >
      <div className="flex items-center">
        <Image
          src="/hoasurvey_logo.png"
          alt="HOA Survey Logo"
          width={48}
          height={48}
          className="mr-3"
        />
        <span
          className="text-2xl font-bold tracking-tight"
          style={{ color: "rgb(var(--text-primary))" }}
        >
          HOA Survey
        </span>
      </div>
    </header>
  );
}
