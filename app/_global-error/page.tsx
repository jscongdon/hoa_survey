import Link from "next/link";

export default function GlobalError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg text-center">
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Something went wrong
        </h1>
        <p className="mt-4 text-gray-700 dark:text-gray-300">
          An unexpected error occurred while rendering this page. You can go
          back to the homepage or try again later.
        </p>
        <div className="mt-6 flex justify-center gap-4">
          <Link href="/" className="px-4 py-2 bg-blue-600 text-white rounded">
            Home
          </Link>
          <Link href="/" className="px-4 py-2 bg-gray-200 text-gray-800 rounded">
            Reload
          </Link>
        </div>
      </div>
    </div>
  );
}
