import nock from 'nock';
import request from 'supertest';

import StaticmanAPI from '../../source/server';

const staticman = new StaticmanAPI().server;
const supportedApiVersions = [['v1']];

// TODO: Rework this once we ditch express-github-webhook

describe.each(supportedApiVersions)('API %s - Webhook endpoint', (version) => {
  it('sends a notification when staticman pull request is merged', async () => {
    const branch = 'staticman_somebranch';
    const repository = 'foobar';
    const username = 'johndoe';

    const pullScope = nock(/api\.github\.com/, {
      reqheaders: {
        authorization: 'token '.concat('1q2w3e4r'),
      },
    })
      .get(`/repos/${username}/${repository}/pulls/1`)
      .reply(200, {
        number: 1,
        title: 'Some PR title',
        body: 'Some PR body text',
        head: {
          ref: 'some-other-branch',
        },
        base: {
          ref: 'master',
        },
        repository: {
          name: repository,
          owner: {
            login: username,
          },
        },
        state: 'merged',
      });

    const mockBody = {
      parameters: {
        branch,
        repository,
        service: 'github',
        username,
        version,
      },
      fields: {
        name: 'John',
      },
      options: {
        subscribe: 'email',
      },
    };

    expect.assertions(1);

    await request(staticman)
      .post(`/${version}/webhook`)
      .set('X-GitHub-Delivery', 'id')
      .set('X-GitHub-Event', 'pull_request')
      .send({
        repository: {
          owner: {
            login: 'johndoe',
          },
          name: 'foobar',
        },
        number: 1,
        body: `<!--staticman_notification:${mockBody}-->`,
      })
      .expect(200);

    expect(pullScope.isDone()).toBe(true);
  });

  it('ignores pull requests not generated by staticman', async () => {
    const pullScope = nock(/api\.github\.com/, {
      reqheaders: {
        authorization: 'token '.concat('1q2w3e4r'),
      },
    })
      .get('/repos/johndoe/foobar/pulls/1')
      .reply(200, {
        number: 1,
        title: 'Some PR title',
        body: 'Some PR body text',
        head: {
          ref: 'some-other-branch',
        },
        base: {
          ref: 'master',
        },
        repository: {
          name: 'foobar',
          owner: {
            login: 'johndoe',
          },
        },
        state: 'merged',
      });

    expect.assertions(1);

    await request(staticman)
      .post(`/${version}/webhook`)
      .set('X-GitHub-Delivery', 'id')
      .set('X-GitHub-Event', 'pull_request')
      .send({
        repository: {
          owner: {
            login: 'johndoe',
          },
          name: 'foobar',
        },
        number: 1,
      })
      .expect(200);

    expect(pullScope.isDone()).toBe(true);
  });

  it('ignores staticman pull requests which have not yet been merged', async () => {
    const pullScope = nock(/api\.github\.com/, {
      reqheaders: {
        authorization: 'token '.concat('1q2w3e4r'),
      },
    })
      .get('/repos/johndoe/foobar/pulls/1')
      .reply(200, {
        number: 1,
        title: 'Some PR title',
        body: 'Some PR body text',
        head: {
          ref: 'some-other-branch',
        },
        base: {
          ref: 'master',
        },
        repository: {
          name: 'foobar',
          owner: {
            login: 'johndoe',
          },
        },
        sourceBranch: 'staticman_somebranch',
        state: 'open',
      });

    expect.assertions(1);

    await request(staticman)
      .post(`/${version}/webhook`)
      .set('X-GitHub-Delivery', 'id')
      .set('X-GitHub-Event', 'pull_request')
      .send({
        repository: {
          owner: {
            login: 'johndoe',
          },
          name: 'foobar',
        },
        number: 1,
      })
      .expect(200);

    expect(pullScope.isDone()).toBe(true);
  });

  it('ignores non-pull request events', async () => {
    await request(staticman)
      .post(`/${version}/webhook`)
      .set('X-GitHub-Delivery', 'id')
      .set('X-GitHub-Event', 'deployment')
      .send({})
      .expect(200);
  });
});