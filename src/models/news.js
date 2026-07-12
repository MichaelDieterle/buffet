module.exports = (sequelize, DataTypes) => {
  const News = sequelize.define('News', {
    uuid: { type: DataTypes.STRING, unique: true, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    publisher: DataTypes.STRING,
    link: DataTypes.STRING,
    publishedAt: DataTypes.DATE,
    type: { type: DataTypes.STRING, defaultValue: 'company' },
    thumbnail: DataTypes.STRING,
    relatedTickers: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  }, { timestamps: true });

  News.associate = (models) => {
    News.belongsTo(models.Stock, { foreignKey: 'stockId', as: 'stock' });
  };

  return News;
};
