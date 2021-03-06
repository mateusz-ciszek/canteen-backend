import { Router } from 'express';
import { MenuController } from '../controller/MenuController';
import { checkAuth } from '../middleware/check-auth';
import { isAdmin } from '../middleware/check-role';
import { PermissionValidator } from '../middleware/PermissionValidator';

export const MenuRouter = Router();

const permissionValidator = new PermissionValidator();
const controller = new MenuController();

/**
 * GET - Zwraca listę wszystkich menu z posiłkami
 * i dodatkami do nich
 *
 * Przykładowa odpowiedź:
 * [
 *   {
 *			"_id": "5bef0f8a2230ef670c779b05",
 *			"name": "Menu obiadowe",
 *			"foods": [
 *					{
 *							"additions": [
 *									{
 *											"_id": "5bef0f8a2230ef670c779b00",
 *											"name": "Ketchup",
 *											"price": 0.1
 *									}
 *							],
 *							"_id": "5bef0f8a2230ef670c779b03",
 *							"name": "Frytki",
 *							"price": 8,
 *							"description": "Karbowane"
 *					},
 *			]
 *   }
 * ]
 */
MenuRouter.get('/',
		(req, res) => controller.getAllMenus(req, res));

/**
 * GET - pobierz config dla modułu menu
 */
MenuRouter.get('/config',
		checkAuth,
		isAdmin,
		(req, res) => controller.getConfig(req, res));

/**
 * GET - Pobierz menu o podanym ID
 */
MenuRouter.get('/:id',
		(req, res) => controller.getManuDetails(req, res));

/**
 * POST - Zapytanie dodające nowe menu do bazy
 */
MenuRouter.post('/',
		checkAuth,
		isAdmin,
		(req, res, next) => permissionValidator.checkPermission('P_MENU_CREATE')(req, res, next),
		(req, res) => controller.createMenu(req, res));

/**
 * POST - Dodaj nowy posiłek do menu
 */
MenuRouter.post('/:menuId/food',
		checkAuth,
		isAdmin,
		(req ,res, next) => permissionValidator.checkPermission('P_MENU_FOOD_CREATE')(req, res, next),
		(req, res) => controller.createFood(req, res));

/**
 * DELETE - Remove menu with all its contents
 */
MenuRouter.delete('/',
		checkAuth,
		isAdmin,
		(req, res, next) => permissionValidator.checkPermission('P_MENU_DELETE')(req, res, next),
		(req, res) => controller.deleteMenus(req, res));

/**
 * PATCH - Update menu name
 */
MenuRouter.patch('/:id',
		checkAuth,
		isAdmin,
		(req, res, next) => permissionValidator.checkPermission('P_MENU_MODIFY')(req, res, next),
		(req, res) => controller.changeName(req, res));
