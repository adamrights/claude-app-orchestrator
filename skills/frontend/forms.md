---
tags: [forms, react-hook-form, form-validation, zod, input]
---

# Forms

## When to use
When building any user input form — login, signup, CRUD operations, settings pages, search filters, multi-step wizards, or file uploads. React Hook Form + Zod is the standard stack for form handling and validation.

## Guidelines

- **Use React Hook Form + Zod** as the default form stack. RHF handles form state and performance; Zod handles schema validation.
- **Prefer uncontrolled inputs via `register`** for performance. RHF avoids re-rendering the entire form on every keystroke by using uncontrolled inputs internally.
- **Define form schemas with Zod** and connect them via `zodResolver`. The schema is the single source of truth for validation rules.
- **Share schemas with the backend** when possible. Define once, validate on both sides.
- **Display errors inline next to the field.** Use `formState.errors` from RHF. Show errors after the user blurs or submits, not while typing.
- **Handle submission states explicitly:** loading (disable submit button, show spinner), error (show message), success (redirect or show confirmation).
- **Use `handleSubmit` from RHF** — it validates before calling your submit function and prevents double submission.
- **Accessible forms are mandatory:** every input needs a visible `<label>`, errors linked via `aria-describedby`, and focus moves to the first error on failed submit.
- **For multi-step forms:** use a single Zod schema with per-step validation via `.pick()` or split into step schemas. Persist state across steps with RHF's `useForm` at the parent level.
- **File uploads:** use `<input type="file">` with `register`, validate file size and type in the Zod schema using `.refine()`.

## Basic Form with React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CreatePostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  category: z.enum(['tech', 'design', 'business']),
});

type CreatePostForm = z.infer<typeof CreatePostSchema>;

export function CreatePostForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostForm>({
    resolver: zodResolver(CreatePostSchema),
  });

  const onSubmit = async (data: CreatePostForm) => {
    await createPost(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" {...register('title')} aria-describedby="title-error" />
        {errors.title && (
          <p id="title-error" role="alert">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="content">Content</label>
        <textarea id="content" {...register('content')} aria-describedby="content-error" />
        {errors.content && (
          <p id="content-error" role="alert">{errors.content.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="category">Category</label>
        <select id="category" {...register('category')} aria-describedby="category-error">
          <option value="">Select...</option>
          <option value="tech">Tech</option>
          <option value="design">Design</option>
          <option value="business">Business</option>
        </select>
        {errors.category && (
          <p id="category-error" role="alert">{errors.category.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Create Post'}
      </button>
    </form>
  );
}
```

## Custom Input Component with Error Display

```tsx
import { type FieldError, type UseFormRegisterReturn } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  id: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
}

export function FormField({ label, id, registration, error, type = 'text' }: FormFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...registration}
      />
      {error && (
        <p id={errorId} role="alert">
          {error.message}
        </p>
      )}
    </div>
  );
}
```

## Async Submission with Loading State

```tsx
const onSubmit = async (data: CreatePostForm) => {
  try {
    const result = await createPost(data);
    toast.success('Post created!');
    router.push(`/posts/${result.id}`);
  } catch (error) {
    console.error('Submit failed:', error);
    toast.error('Failed to create post. Please try again.');
  }
};
```

## Multi-Step Form Pattern

```tsx
const StepOneSchema = FullSchema.pick({ name: true, email: true });
const StepTwoSchema = FullSchema.pick({ address: true, city: true });

function MultiStepForm() {
  const [step, setStep] = useState(1);
  const form = useForm<FullFormData>({
    resolver: zodResolver(step === 1 ? StepOneSchema : StepTwoSchema),
    mode: 'onBlur',
  });

  const onNext = async () => {
    const valid = await form.trigger(); // Validate current step fields
    if (valid) setStep((s) => s + 1);
  };

  const onSubmit = async (data: FullFormData) => {
    await submitForm(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {step === 1 && <StepOneFields register={form.register} errors={form.formState.errors} />}
      {step === 2 && <StepTwoFields register={form.register} errors={form.formState.errors} />}
      {step < 2 ? (
        <button type="button" onClick={onNext}>Next</button>
      ) : (
        <button type="submit">Submit</button>
      )}
    </form>
  );
}
```

## Checklist
- [ ] Form uses React Hook Form + Zod for validation
- [ ] Every input has a visible label
- [ ] Errors display inline with `aria-describedby` linking
- [ ] Submit button is disabled while submitting
- [ ] Success and error states are handled after submission
- [ ] Schema is shared with backend if applicable
