'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminBrandsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/payment-methods');
  }, [router]);
  return null;
}
