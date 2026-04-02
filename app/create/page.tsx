import { CreateContractScreen } from "@/components/create/create-contract-screen";

interface CreateContractPageProps {
  searchParams: Promise<{
    templateId?: string;
  }>;
}

export default async function CreateContractPage({ searchParams }: CreateContractPageProps) {
  const params = await searchParams;
  return <CreateContractScreen initialTemplateId={params.templateId} />;
}
