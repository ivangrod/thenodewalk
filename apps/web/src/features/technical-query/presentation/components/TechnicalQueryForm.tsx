'use client';

import { Search } from 'lucide-react';
import type { FormEvent, ReactElement } from 'react';

import { Button } from '@/components/ui/button';

const QUERY_FIELD_NAME = 'technical-query';

export interface TechnicalQueryFormProps {
  onSubmit: (query: string) => void;
  disabled?: boolean;
}

export function TechnicalQueryForm({
  onSubmit,
  disabled = false,
}: TechnicalQueryFormProps): ReactElement {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(String(formData.get(QUERY_FIELD_NAME) ?? ''));
  };

  return (
    <form aria-label="Technical query" className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label className="text-sm font-medium" htmlFor={QUERY_FIELD_NAME}>
        Ask a technical question
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="h-11 flex-1 rounded-md border bg-background px-3 text-base"
          disabled={disabled}
          id={QUERY_FIELD_NAME}
          name={QUERY_FIELD_NAME}
          placeholder="How does Netflix scale its API?"
          required
          type="search"
        />
        <Button disabled={disabled} size="lg" type="submit">
          <Search aria-hidden="true" />
          Search
        </Button>
      </div>
    </form>
  );
}
