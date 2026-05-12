import { LibraryFoldersPanel } from '../components/library/LibraryFoldersPanel';

export const FoldersPage = (): JSX.Element => {
  return (
    <div className="page-stack">
      <header className="plain-page-header">
        <h1>Folders</h1>
        <p>Manage local library folders and scan status</p>
      </header>

      <LibraryFoldersPanel />
    </div>
  );
};
