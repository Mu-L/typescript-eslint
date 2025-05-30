import { describeFilePath } from '../../src/create-program/describeFilePath';

describe(describeFilePath, () => {
  describe.for(['./repos/repo', '/repos/repo', '~/repos/repo'] as const)(
    'tsconfigRootDir %s',
    tsconfigRootDir => {
      test.for([
        './elsewhere/repo/file.ts',
        './elsewhere/repo/nested/file.ts',
        './repos/file.ts',
        './repos/other/file.ts',
        './repos/repo/file.ts',
        './repos/repo/nested/file.ts',
        '/elsewhere/repo/file.ts',
        '/elsewhere/repo/nested/file.ts',
        '/file.ts',
        '/nested/file.ts',
        '/repos/repo/file.ts',
        '/repos/repo/nested/file.ts',
        '~/file.ts',
        '~/nested/file.ts',
        '~/nested/file.ts',
        '~/other/nested/path/to/file.ts',
        '~/other/repo/file.ts',
        '~/repos/file.ts',
        '~/repos/other/file.ts',
        '~/repos/other/nested/file.ts',
        '~/repos/repo/file.ts',
        '~/repos/repo/nested/file.ts',
        'A:/file.ts',
        'A:/nested/file.ts',
        'ABC:/file.ts',
        'C:/file.ts',
        'file.ts',
        'nested/file.ts',
      ] as const)('filePath %s', (filePath, { expect }) => {
        expect(
          describeFilePath(filePath, tsconfigRootDir).replaceAll('\\', '/'),
        ).toMatchSnapshot();
      });
    },
  );
});
