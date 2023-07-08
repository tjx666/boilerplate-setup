import { constants as FS_CONSTANTS } from 'node:fs';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Options as ExecaOptions } from 'execa';
import { execa } from 'execa';

import type { Pkg } from './types';

export const cwd = process.cwd();
export const pkgPath = resolve(cwd, 'package.json');

export async function getPkg() {
    return JSON.parse(await fs.readFile(pkgPath, 'utf8')) as Pkg;
}

export async function updatePkg(newPkg: Pkg) {
    await fs.writeFile(pkgPath, `${JSON.stringify(newPkg, null, 4)}\n`);
}

export const pkg = await getPkg();

export async function pathExists(path: string) {
    return fs
        .access(path, FS_CONSTANTS.F_OK)
        .then(() => true)
        .catch(() => false);
}

export async function runShellCmd(cmd: string, options?: ExecaOptions) {
    const [exe, ...args] = cmd.split(/\s+/);
    return execa(exe, args, {
        cwd,
        ...options,
    });
}
