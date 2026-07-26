import { notFound } from "next/navigation";
import { ReaderView } from "@/components/reader/ReaderView";
import { getBuiltinArticle } from "@/lib/builtin-course";

interface ReadPageProps {
  params: Promise<{ articleId: string }>;
}

export default async function ReadPage({ params }: ReadPageProps) {
  const { articleId } = await params;
  const article = getBuiltinArticle(articleId);

  if (!article || article.status === "locked") {
    notFound();
  }

  return <ReaderView article={article} backHref={`/courses/${article.courseId}`} />;
}
