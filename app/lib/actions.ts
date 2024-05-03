'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ invalid_type_error: 'Please select customer.' }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please provide a number greater than zero.' }),
  status: z.enum(['paid', 'pending'], {
    invalid_type_error: 'Please select payment status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
  const validatedFeilds = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFeilds.success) {
    return {
      errors: validatedFeilds.error.flatten().fieldErrors,
      message: 'Failed to create invoice, missing feilds.',
    };
  }

  const { customerId, amount, status } = validatedFeilds.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (e) {
    return {
      message: 'error in creating new entry',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  const validatedFeilds = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFeilds.success) {
    return {
      errors: validatedFeilds.error.flatten().fieldErrors,
      message: 'Failed to update Invoice, Incomplete feilds',
    };
  }

  const { customerId, amount, status } = validatedFeilds.data;
  const amountInCents = amount * 100;

  try {
    await sql`
    UPDATE invoices
    SET customer_id=${customerId}, amount=${amountInCents}, status=${status}
    WHERE id=${id}
    `;
  } catch (e) {
    return { message: 'error in updating the entry' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  // throw new Error('Failed to Delete Invoice');

  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
  } catch (e) {
    return { message: 'error in deleting the entry' };
  }
  revalidatePath('/dashboard/invoices');
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid Credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
