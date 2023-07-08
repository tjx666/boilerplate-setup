import type { PackageJson, RequiredDeep } from 'type-fest';

import type { validCategories } from './constants';

export interface RepositoryInfo {
    hostname: string;
    /** git config user.name */
    name: string;
    /** git config ussr.email */
    email: string;
    /** github personal homepage */
    url: string;
    /** github user account name */
    userName: string;
    repoName: string;
    repoUrl: string;
}

export type ExtensionCategory = typeof validCategories extends Set<infer V> ? V : never;

export type Pkg = Exclude<
    PackageJson,
    'author' | 'bugs' | 'repository' | 'homepage' | 'engines' | 'devDependencies'
> & {
    displayName: string;
    categories: ExtensionCategory[];
    badges: Array<{
        url: string;
        description: string;
        href: string;
    }>;
    homepage: string;
    author: RequiredDeep<Extract<NonNullable<PackageJson['author']>, object>>;
    bugs: RequiredDeep<Extract<PackageJson['bugs'], object>>;
    repository: RequiredDeep<Extract<PackageJson['repository'], object>>;
    engines: {
        vscode: string;
    };
    devDependencies: Record<string, string>;
};
