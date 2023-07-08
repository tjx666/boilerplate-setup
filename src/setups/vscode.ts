import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import * as p from '@clack/prompts';
import { capitalCase } from 'capital-case';
import { execa } from 'execa';
import gradientString from 'gradient-string';
import logSymbols from 'log-symbols';
import c from 'picocolors';

import { validCategories } from '../constants';
import type { ExtensionCategory, Pkg, RepositoryInfo } from '../types';
import { cwd, getPkg, pathExists, pkg, runShellCmd, updatePkg } from '../utils';

const separatorRegexp = /\s*,\s*/;
const repositoryUrlRegexp = /https:\/\/[\w\-.]+\/\w+\/[\w\-]+/;

function link(url: string) {
    return c.underline(c.cyan(url));
}

/**
 * @see https://code.visualstudio.com/api/references/extension-manifest
 * @see https://docs.npmjs.com/cli/v7/configuring-npm/package-json
 */
export async function setup(repositoryInfo: RepositoryInfo) {
    p.intro(c.cyan(c.bold(`Setup for ${gradientString.passion('Awesome VSCode Boilerplate')}`)));

    const installed = await pathExists(resolve(cwd, 'node_modules'));
    const options = await p.group(
        {
            name: () => {
                return p.text({
                    message: 'The name of the extension',
                    initialValue: repositoryInfo.repoName,
                    validate: (value) => {
                        if (!/^[a-z\-]+$/.test(value)) return 'must be kebab-case';
                    },
                });
            },
            displayName: ({ results }) => {
                return p.text({
                    message: 'The display name for the extension used in the Marketplace',
                    initialValue: capitalCase(results.name!),
                    validate: (value) => {
                        if (!value) return "display name can't be empty";

                        const capitalCased = capitalCase(value);
                        if (capitalCased !== value)
                            return `recommend use capital case: ${capitalCased}`;
                    },
                });
            },
            description: () => {
                return p.text({
                    message: 'A short description of what your extension is and does.',
                    validate: (value) => {
                        if (!value) return "description name can't be empty";
                    },
                });
            },
            authorName: () => {
                return p.text({
                    message: 'The name of author',
                    initialValue: repositoryInfo.name,
                    validate: (value) => {
                        if (!value) return "author name can't be empty";
                    },
                });
            },
            authorEmail: () => {
                return p.text({
                    message: 'The email of author',
                    initialValue: repositoryInfo.email,
                    validate: (value) => {
                        if (!value) return "author email can't be empty";
                    },
                });
            },
            authorUrl: () => {
                return p.text({
                    message: 'The personal homepage url of author',
                    initialValue: repositoryInfo.url,
                    validate: (value) => {
                        if (!value) return "author url can't be empty";
                    },
                });
            },
            keywords: async (): Promise<string[]> => {
                const input = await p.text({
                    message:
                        'An array of keywords to make it easier to find the extension, separated by comma: ","',
                    validate: (value) => {
                        if (!value) return "keywords can't be empty";

                        if (value.trim().split(separatorRegexp).length > 5)
                            return 'this list is currently limited to 5 keywords';
                    },
                });
                if (p.isCancel(input)) return [];
                return input.trim().split(separatorRegexp).filter(Boolean);
            },
            categories: async (): Promise<ExtensionCategory[]> => {
                const input = await p.text({
                    message: 'The categories you want to use for the extensions',
                    initialValue: 'Other',
                    validate: (value) => {
                        if (!value) return "author url can't be empty";

                        const categories = value.trim().split(separatorRegexp);
                        const notValidCategories = categories.filter(
                            (category) => !validCategories.has(category as ExtensionCategory),
                        );
                        if (notValidCategories.length > 0) {
                            const notValidCategoriesStr = notValidCategories.join(', ');
                            const validCategoriesStr = [...validCategories.values()].join(', ');
                            return `these categories not valid: ${notValidCategoriesStr}, valid categories: ${validCategoriesStr}`;
                        }
                    },
                });
                if (p.isCancel(input)) return [];
                return input.trim().split(separatorRegexp).filter(Boolean) as ExtensionCategory[];
            },
            installDeps: async (): Promise<boolean> => {
                if (installed) return false;

                const input = await p.confirm({
                    message: 'Pnpm install?',
                    initialValue: true,
                });

                if (p.isCancel(input)) return false;
                return input;
            },
            updateDeps: async ({ results }): Promise<boolean> => {
                if (installed || results.installDeps) {
                    const input = await p.confirm({
                        message: 'Upgrade deps?',
                        initialValue: true,
                    });

                    if (p.isCancel(input)) return false;
                    return input;
                }
                return false;
            },
            commit: () =>
                p.confirm({
                    initialValue: true,
                    message: 'Git commit?',
                }),
        },
        {
            onCancel({ results }) {
                if (typeof results.installDeps !== 'boolean') {
                    const addresses = [
                        'https://code.visualstudio.com/api/references/extension-manifest',
                        'https://docs.npmjs.com/cli/v7/configuring-npm/package-json',
                    ];
                    p.note(addresses.map(link).join('\n'), 'Some useful Links');
                }
                p.cancel('Operation cancelled.');
                process.exit(0);
            },
        },
    );

    const spinner = p.spinner();
    const runStep = async (message: string, task: () => Promise<void>) => {
        spinner.start(message);
        await task();
        spinner.stop(`${message} ${logSymbols.success}`);
    };

    await runStep('replace boilerplate code in package.json', async () => {
        const newPkg = JSON.parse(JSON.stringify(pkg)) as Pkg;
        newPkg.name = options.name;
        newPkg.displayName = options.displayName as string;
        newPkg.description = options.description;
        newPkg.author = {
            name: options.authorName,
            email: options.authorEmail,
            url: options.authorUrl,
        };
        newPkg.keywords = options.keywords;
        newPkg.categories = options.categories!;

        newPkg.homepage = newPkg.homepage.replace(repositoryUrlRegexp, repositoryInfo.repoUrl);
        newPkg.repository.url = repositoryInfo.repoUrl;
        newPkg.bugs.url = newPkg.bugs.url?.replace(repositoryUrlRegexp, repositoryInfo.repoUrl);
        newPkg.bugs.email = repositoryInfo.email;

        const prWelcomeBadge = newPkg.badges.find((b) => b.description === 'PRs Welcome');
        if (prWelcomeBadge) {
            prWelcomeBadge.href = prWelcomeBadge.href.replace(
                repositoryUrlRegexp,
                repositoryInfo.repoUrl,
            );
        }
        await updatePkg(newPkg);
    });

    await runStep('empty the CHANGELOG.md', async () => {
        const changelogPath = resolve(cwd, './CHANGELOG.md');
        const changelog = await fs.readFile(changelogPath, 'utf8');
        const frontCommentsOfChangeLog: string[] = [];
        for (const line of changelog.split(/\r\n|\r|\n/)) {
            if (line.startsWith('<!--')) {
                frontCommentsOfChangeLog.push(line);
            }
        }
        await fs.writeFile(changelogPath, `${frontCommentsOfChangeLog.join('\n')}\n`, 'utf8');
    });

    await runStep('update year and owner in LICENSE', async () => {
        const licensePath = resolve(cwd, 'LICENSE');
        const license = await fs.readFile(licensePath, 'utf8');
        const updatedLicense = license.replace(
            /Copyright \(c\) \d+ \w+/,
            `Copyright (c) ${new Date().getFullYear()} ${repositoryInfo.name}`,
        );
        await fs.writeFile(licensePath, updatedLicense, 'utf8');
    });

    if (options.installDeps) {
        const cmd = 'pnpm install';
        await runStep(`install deps by ${c.dim(cmd)}`, async () => {
            await runShellCmd(cmd);
        });
    }

    if (options.updateDeps) {
        const cmd = 'npx --yes taze';
        await runStep(`update deps by ${c.dim(cmd)}`, async () => {
            await runShellCmd(cmd);
        });
        const pkg = await getPkg();
        pkg.engines.vscode = pkg.devDependencies['@types/vscode'];
    }

    if (options.commit) {
        await runStep(`git add and git commit`, async () => {
            await runShellCmd('git add -A');
            await execa('git', ['commit', '-m', 'chore: setup boilerplate'], { cwd });
        });
    }

    const nextSteps1 = `Set the github actions secrets to publish the Extensions:
    ${link('https://github.com/tjx666/awesome-vscode-extension-boilerplate#publish')}

Enable the github action write permission to publish github release:
    ${link('https://github.com/antfu/changelogithub/issues/24')}`;
    p.note(nextSteps1, 'Check following before publish');
    p.outro(`Problems? ${link(pkg.bugs.url)}`);
}
