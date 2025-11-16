import Image from 'next/image';

export default function Header() {
  return (
    <header className="w-full py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 mb-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center">
        <Image
          src="/hoasurvey_logo.png"
          alt="HOA Survey Logo"
          width={48}
          height={48}
          className="mr-3"
        />
        <span className="text-2xl font-bold tracking-tight">HOA Survey</span>
      </div>
    </header>
  );
}
