import console from 'consola';

import { setup } from './setups/vscode';
import type { RepositoryInfo } from './types';
import { runShellCmd } from './utils';

async function hasUncommittedChanges() {
    const { stdout } = await runShellCmd('git status --porcelain');
    return stdout.trim().length > 0;
}

async function getRepositoryInfo(): Promise<RepositoryInfo> {
    const { stdout } = await runShellCmd('git config --get remote.origin.url');
    const sshUrlRegexp = /git@([\w\-.]+):(\w+)\/([\w\-]+)\.git/;
    if (!sshUrlRegexp.test(stdout)) {
        throw new Error('You must set a remote named origin with ssh format');
    }
    const [, hostname, userName, repoName] = stdout.match(sshUrlRegexp)!;
    const { stdout: name } = await runShellCmd('git config --get user.name');
    const { stdout: email } = await runShellCmd('git config --get user.email');
    return {
        name,
        email,
        url: `https://${hostname}/${userName}/${userName}`,
        hostname,
        userName,
        repoName,
        repoUrl: `https://${hostname}/${userName}/${repoName}`,
    };
}

async function main() {
    if (await hasUncommittedChanges()) {
        console.error('please commit the git changes before you run setup!');
        // process.exit(-1);
    }

    const repositoryInfo = await getRepositoryInfo();
    setup(repositoryInfo);
}

main();
