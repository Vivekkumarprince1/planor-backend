import express from 'express';
import { Category, Subcategory } from '../models/Taxonomy';
import { auth, requireRole } from '../middleware/auth';

const router = express.Router();

// GET /api/categories - Get all categories with subcategories
router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    
    const categoriesWithSubcategories = await Promise.all(
      categories.map(async (category) => {
        const subcategories = await Subcategory.find({
          categoryId: category._id,
          isActive: true
        }).sort({ name: 1 });
        
        return {
          ...category.toObject(),
          subcategories
        };
      })
    );

    res.json({
      success: true,
      data: categoriesWithSubcategories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// GET /api/categories/subcategories - Get subcategories with optional category filter
router.get('/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.query;
    
    const filter: any = { isActive: true };
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    const subcategories = await Subcategory.find(filter)
      .populate('categoryId', 'name slug')
      .sort({ name: 1 });

    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Get all subcategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategories'
    });
  }
});

// GET /api/categories/:categoryId - Get specific category with subcategories
router.get('/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const subcategories = await Subcategory.find({
      categoryId: category._id,
      isActive: true
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: {
        ...category.toObject(),
        subcategories
      }
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category'
    });
  }
});

// POST /api/categories - Create new category (admin only)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;

    // Check if category with same name exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      });
    }

    const category = new Category({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: description || '',
      icon,
      color: color || '#007AFF',
      isActive: true,
      hasSubcategories: false
    });

    await category.save();

    res.status(201).json({
      success: true,
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
});

// GET /api/categories/:categoryId/subcategories - Get subcategories for a category
router.get('/:categoryId/subcategories', async (req, res) => {
  try {
    const { categoryId } = req.params;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const subcategories = await Subcategory.find({
      categoryId: categoryId,
      isActive: true
    }).sort({ name: 1 });

    res.json({
      success: true,
      data: subcategories
    });
  } catch (error) {
    console.error('Get subcategories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subcategories'
    });
  }
});

// POST /api/categories/:categoryId/subcategories - Create subcategory (admin only)
router.post('/:categoryId/subcategories', auth, requireRole('admin'), async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, icon } = req.body;

    // Check if category exists
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Check if subcategory with same name exists in this category
    const existingSubcategory = await Subcategory.findOne({
      categoryId: categoryId,
      name: name
    });
    if (existingSubcategory) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory with this name already exists in this category'
      });
    }

    const subcategory = new Subcategory({
      categoryId: categoryId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: description || '',
      icon,
      isActive: true
    });

    await subcategory.save();

    // Update category to indicate it has subcategories
    category.hasSubcategories = true;
    await category.save();

    res.status(201).json({
      success: true,
      data: subcategory
    });
  } catch (error) {
    console.error('Create subcategory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subcategory'
    });
  }
});

export default router;
