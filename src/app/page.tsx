import { redirect } from 'next/navigation';

/**
 * Home Page - Redirects to projects
 */
export default function HomePage() {
  redirect('/projects');
}
