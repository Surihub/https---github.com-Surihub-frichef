import React from 'react';

const paths = {
  edit: <><path d="m14.5 4.5 5 5M4 20l4.7-1 12-12a1.8 1.8 0 0 0 0-2.5l-1.2-1.2a1.8 1.8 0 0 0-2.5 0l-12 12L4 20Z" /><path d="m6 15 3 3" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" /></>,
  note: <><path d="M14 3H5v18h14V8l-5-5Z" /><path d="M14 3v5h5M8 12h8M8 16h5" /></>,
  arrow: <><path d="M6 18 18 6M7 6h11v11" /></>,
};
export default function LinkIcon({ name, className = '' }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{paths[name]}</svg>;
}
