import { Router, Request, Response } from 'express';
import { Service } from '../models/Service';

const router = Router();

// Get all available areas where services are offered
router.get('/', async (req: Request, res: Response) => {
  try {
    // Aggregate all unique areas from approved services
    const areas = await Service.aggregate([
      {
        $match: {
          isActive: true,
          status: 'approved',
          areaServed: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: '$areaServed'
      },
      {
        $group: {
          _id: '$areaServed',
          serviceCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          serviceCount: 1
        }
      },
      {
        $sort: { serviceCount: -1, name: 1 }
      }
    ]);

    return res.json({ 
      success: true, 
      data: areas 
    });
  } catch (error) {
    console.error('Areas list error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch areas' 
    });
  }
});

// Get service statistics by area
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await Service.aggregate([
      {
        $match: {
          isActive: true,
          status: 'approved',
          areaServed: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: '$areaServed'
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'categoryId',
          foreignField: '_id',
          as: 'category'
        }
      },
      {
        $unwind: '$category'
      },
      {
        $group: {
          _id: {
            area: '$areaServed',
            categoryId: '$categoryId',
            categoryName: '$category.name'
          },
          serviceCount: { $sum: 1 },
          avgPrice: { $avg: '$basePrice' },
          minPrice: { $min: '$basePrice' },
          maxPrice: { $max: '$basePrice' }
        }
      },
      {
        $group: {
          _id: '$_id.area',
          totalServices: { $sum: '$serviceCount' },
          categories: {
            $push: {
              categoryId: '$_id.categoryId',
              categoryName: '$_id.categoryName',
              serviceCount: '$serviceCount',
              avgPrice: '$avgPrice',
              minPrice: '$minPrice',
              maxPrice: '$maxPrice'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          area: '$_id',
          totalServices: 1,
          categories: 1
        }
      },
      {
        $sort: { totalServices: -1 }
      }
    ]);

    return res.json({ 
      success: true, 
      data: stats 
    });
  } catch (error) {
    console.error('Area stats error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch area statistics' 
    });
  }
});

export default router;
