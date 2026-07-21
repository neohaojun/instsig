"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function RequestAttachmentLink({
  label,
  path,
  dataUrl,
  name,
}: {
  label: string;
  path?: string;
  dataUrl?: string;
  name: string;
}) {
  const [url, setUrl] = useState<string | null>(dataUrl ?? null);

  useEffect(() => {
    if (dataUrl) {
      setUrl(dataUrl);
      return;
    }
    if (!path) {
      setUrl(null);
      return;
    }

    let active = true;
    fetch(`/api/request-attachments?path=${encodeURIComponent(path)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null) as { url?: string } | null;
        if (!response.ok) console.warn("Failed to create attachment link", { status: response.status });
        if (active) setUrl(data?.url ?? null);
      });
    return () => { active = false; };
  }, [dataUrl, path]);

  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <FileImage className="h-5 w-5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm text-foreground">{name}</span>
        </div>
        <Button asChild={Boolean(url)} variant="outline" size="sm" disabled={!url}>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="gap-2">
              View <ExternalLink className="h-4 w-4" />
            </a>
          ) : <span>View</span>}
        </Button>
      </div>
    </div>
  );
}
