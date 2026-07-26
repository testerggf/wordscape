import { notFound } from "next/navigation";
import { ReaderView } from "@/components/reader/ReaderView";
import { getArticle } from "@/lib/seed-data";

interface ReadPageProps {
  params: Promise<{ articleId: string }>;
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { articleId } = await params;
  const article = getArticle(articleId);

  if (!article || article.status === "locked") {
    notFound();
  }

  return <ReaderView article={article} backHref={`/courses/${article.courseId}`} />;
}
