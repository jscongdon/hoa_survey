import React from "react";
import clsx from "clsx";

interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: boolean;
  accept?: string;
}

export const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, error, accept, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="file"
        accept={accept}
        className={clsx(
          "w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-l file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-600 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-500",
          error
            ? "border-red-500 focus:ring-red-500"
            : "border-gray-300 dark:border-gray-600 focus:ring-blue-500",
          className
        )}
        {...props}
      />
    );
  }
);

FileInput.displayName = "FileInput";