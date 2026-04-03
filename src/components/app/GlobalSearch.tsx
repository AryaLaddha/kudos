"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Command,
} from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { searchGlobal } from "@/app/(app)/actions/search";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [users, setUsers] = React.useState<any[]>([]);

  // Debounce query
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results
  React.useEffect(() => {
    async function fetchResults() {
      if (!debouncedQuery) {
        setUsers([]);
        return;
      }
      setLoading(true);
      const results = await searchGlobal(debouncedQuery);
      setUsers(results.users);
      setLoading(false);
    }
    fetchResults();
  }, [debouncedQuery]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`/profile/${id}`);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60 shadow-sm bg-white"
      >
        <Search className="h-4 w-4 text-slate-400" />
        <span className="flex-1 text-left text-slate-500">Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Search users..." 
            value={query} 
            onValueChange={setQuery} 
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Searching..." : debouncedQuery ? "No results found." : "Start typing to search..."}
            </CommandEmpty>
            
            {users.length > 0 && (
              <CommandGroup heading="Users">
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={() => handleSelect(user.id)}
                    className="flex items-center gap-3 p-2 cursor-pointer"
                  >
                    <Avatar className="h-8 w-8 mix-blend-multiply">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 font-bold">
                        {user.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{user.full_name}</span>
                      {user.job_title && (
                        <span className="text-xs text-muted-foreground">{user.job_title}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
