import { useState } from 'react';

// Form state for the log-in and sign-up pages. Errors the API ties to a field (validation
// problems, a taken username) show under that input; anything else shows above the form.
export default function useAuthForm(initialValues, submit) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await submit(values);
      // On success the page redirects, so there's nothing to reset.
    } catch (err) {
      if (err.details?.fields) setFieldErrors(err.details.fields);
      else setFormError(err.message);
      setSubmitting(false);
    }
  }

  return { values, update, fieldErrors, formError, submitting, handleSubmit };
}
