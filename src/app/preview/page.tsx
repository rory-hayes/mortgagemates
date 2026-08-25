import { ProductPreview } from "@/components/preview/product-preview";

export const metadata = { title: "Sample portal" };

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  return <ProductPreview initialView={params.view} />;
}
