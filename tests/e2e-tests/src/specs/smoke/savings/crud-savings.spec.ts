import { test, Page, expect } from '@playwright/test';
import { DEFAULT_USER_CURRENCIES, signInUser } from '../../../helpers/auth.helper';
import { getDefaultUserData } from '../../../config';

import GraphqlService from '../../../services/graphql.service';
import { NAV_MENU, navigateMenu } from '../../../helpers/nav-menu.helper';
import { v4 as uuidv4 } from 'uuid';
import { waitForRequest } from '../../../helpers/generic.helper';
import { createSaving, deleteSaving, updateSaving } from '../../../helpers/saving.helper';
import { DateTime } from 'luxon';

let email: string;
let password: string;

test.describe.configure({ mode: 'serial' });

let page: Page;

let graphqlService: GraphqlService;

let bankId1: string;
let bankId2: string;

let bankAccountId1: string;
let bankAccountId2: string;

let userCurrencies: any[];

let savingId: string;

const savingName: string = `Saving ${uuidv4()}`;

test.beforeAll(async ({ browser }) => {
	const defaultUserData = getDefaultUserData();
	email = defaultUserData.email;
	password = defaultUserData.password;
	page = await browser.newPage();
	await page.goto('/');
	await page.waitForLoadState('load');
	const {authToken} = await signInUser(page, { email, password }, false);
	graphqlService = new GraphqlService(authToken);

	userCurrencies = await graphqlService.getUserCurrencies();

	const bank1 = await graphqlService.createBank({
		name: 'Bank #1'
	});
	bankId1 = bank1.id;

	const bank2 = await graphqlService.createBank({
		name: 'Bank #2'
	});
	bankId2 = bank2.id;

	const bankAccount1 = await graphqlService.createBankAccount({
		label: 'Bank Account #1',
		accountNumber: '123456',
		balance: 200,
		bankId: bankId1,
		currencyId: userCurrencies.find(c => c.code === DEFAULT_USER_CURRENCIES[0]).id
	});
	bankAccountId1 = bankAccount1.id;

	const bankAccount2 = await graphqlService.createBankAccount({
		label: 'Bank Account #2',
		accountNumber: '0987653',
		balance: 4000,
		bankId: bankId2,
		currencyId: userCurrencies.find(c => c.code === DEFAULT_USER_CURRENCIES[1]).id
	});
	bankAccountId2 = bankAccount2.id;
});

test.afterAll(async () => {
	await graphqlService.deleteBankAccount(bankAccountId1);
	await graphqlService.deleteBankAccount(bankAccountId2);
	await graphqlService.deleteBank(bankId1);
	await graphqlService.deleteBank(bankId2);
	await page.close();
});

test('Create Saving', async () => {
	const waitForSavings = waitForRequest(page, 'userSavings');
	await navigateMenu(page, NAV_MENU.SAVINGS);
	await waitForSavings;
	const saving: any = await createSaving(page, {
		name: savingName,
		targetDate: DateTime.now().toJSDate(),
		targetAmount: 3000,
		bankAccountName: 'Bank Account #1'
	});
	savingId = saving.id;
	const emptyStateContainer = page.locator(
		'div[data-tn="empty-state-no-savings"]',
	);
	await expect(emptyStateContainer).not.toBeVisible();
	await expect(
		page.locator(`div.card[data-tn="saving-card-${savingId}"]`),
	).toBeVisible();
	await expect(page.locator(`div.card[data-tn="saving-card-${savingId}"] div.card-header h6`)).toHaveText(savingName);
});
test('Update Saving', async () => {
	const newSavingName = savingName + ' - updated';
	await updateSaving(page, savingId, {
		name: newSavingName,
		targetDate: DateTime.now().plus({day: 10}).toJSDate(),
		targetAmount: 2500,
		bankAccountName: 'Bank Account #2'
	});
	await expect(page.locator(`div.card[data-tn="saving-card-${savingId}"] div.card-header h6`)).toHaveText(newSavingName);
});
test('Delete Saving', async () => {
	await deleteSaving(page, savingId);
	await expect(
		page.locator(`div.card[data-tn="saving-card-${savingId}"]`),
	).not.toBeVisible();
});
