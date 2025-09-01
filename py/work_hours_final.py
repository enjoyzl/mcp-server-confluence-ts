# -*- coding: utf-8 -*-
import matplotlib
matplotlib.use('Agg')  # 使用Agg后端，适用于无图形环境
import matplotlib.pyplot as plt
import numpy as np
from collections import defaultdict
import sys
import csv
import os
reload(sys)
sys.setdefaultencoding('utf-8')

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

def read_data_from_csv(csv_file):
    """从CSV文件读取数据"""
    data = []
    if os.path.exists(csv_file):
        print(u"从CSV文件读取数据: {}".format(csv_file))
        import codecs
        with codecs.open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            header = next(reader)  # 跳过标题行
            for row in reader:
                if len(row) >= 3:
                    title = unicode(row[0]) if not isinstance(row[0], unicode) else row[0]
                    parent = unicode(row[1]) if not isinstance(row[1], unicode) else row[1]
                    try:
                        hours = float(row[2])
                        data.append((title, parent, hours))
                    except ValueError:
                        print(u"跳过无效行: {}".format(row))
    else:
        print(u"错误：CSV文件 '{}' 不存在！请确保数据文件存在。".format(csv_file))
        print(u"CSV文件格式应为：")
        print(u"标题,父需求,完成工时")
        print(u"示例行：开发,开发,100")
        return []
    return data

# 读取数据（仅从CSV文件读取）
csv_filename = 'work_hours_data.csv'
data = read_data_from_csv(csv_filename)

# 检查是否成功读取到数据
if not data:
    print(u"无法读取数据，程序退出。")
    exit(1)

print(u"成功读取 {} 条工时记录".format(len(data)))

# 数据处理：按父需求分组汇总
parent_data = defaultdict(lambda: defaultdict(float))
parent_totals = defaultdict(float)

for title, parent, hours in data:
    parent_data[parent][title] += hours
    parent_totals[parent] += hours

# 按总工时排序父需求
sorted_parents = sorted(parent_totals.keys(), key=lambda x: parent_totals[x], reverse=True)

# 创建图表
fig, ax = plt.subplots(figsize=(18, 12))

# 颜色配置 - 使用更丰富的颜色
colors = ['#FF9999', '#66B2FF', '#99FF99', '#FFCC99', '#FF99CC', 
          '#99CCFF', '#FFD700', '#FFA07A', '#98FB98', '#DDA0DD',
          '#87CEEB', '#F0E68C', '#FFB6C1', '#B0C4DE', '#FFEFD5',
          '#E6E6FA', '#FFF8DC', '#FFFACD', '#F5F5DC', '#F0F8FF']

bar_width = 0.7
x_positions = range(len(sorted_parents))

# 绘制堆积柱状图
for i, parent in enumerate(sorted_parents):
    tasks = parent_data[parent]
    parent_total = parent_totals[parent]
    
    # 按工时排序任务
    sorted_tasks = sorted(tasks.items(), key=lambda x: x[1], reverse=True)
    
    bottom = 0
    color_idx = 0
    
    for title, hours in sorted_tasks:
        percentage = (hours / parent_total) * 100
        
        # 绘制堆积条
        bar = ax.bar(i, hours, bottom=bottom, width=bar_width, 
                    color=colors[color_idx % len(colors)], 
                    edgecolor='white', linewidth=1.5, alpha=0.8)
        
        # 添加标签（只有当高度足够且百分比大于3%时才显示）
        if hours > parent_total * 0.03 and percentage > 3:
            label_y = bottom + hours / 2
            # 简化标题显示
            short_title = title[:6] + "..." if len(title) > 8 else title
            # 格式：标题-工时h, 百分比%
            label_text = u"{}-{:.1f}h\n{:.1f}%".format(short_title, hours, percentage)
            
            ax.text(i, label_y, label_text, ha='center', va='center', 
                   fontsize=8, fontweight='bold', color='black',
                   bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.9, edgecolor='gray'))
        
        bottom += hours
        color_idx += 1

# 设置图表属性
ax.set_xlabel(u'父需求分类', fontsize=14, fontweight='bold')
ax.set_ylabel(u'完成工时（小时）', fontsize=14, fontweight='bold')
ax.set_title(u'项目工时分布堆积柱状图\n按父需求汇总，显示子任务占比', fontsize=18, fontweight='bold', pad=25)

# 设置x轴标签
ax.set_xticks(x_positions)
ax.set_xticklabels(sorted_parents, rotation=0, ha='center', fontsize=12)

# 在每个柱子顶部显示总工时
for i, parent in enumerate(sorted_parents):
    total_hours = parent_totals[parent]
    ax.text(i, total_hours + 15, u'{:.1f}h\n({:.1f}%)'.format(total_hours, (total_hours/sum(parent_totals.values()))*100), 
           ha='center', va='bottom', fontsize=11, fontweight='bold',
           bbox=dict(boxstyle='round,pad=0.3', facecolor='lightblue', alpha=0.7))

# 设置网格
ax.grid(True, alpha=0.3, axis='y', linestyle='--')
ax.set_axisbelow(True)

# 设置y轴范围
max_height = max(parent_totals.values())
ax.set_ylim(0, max_height * 1.15)

# 添加总计信息
total_hours = sum(parent_totals.values())
ax.text(0.02, 0.98, u'项目总工时: {:.1f}小时'.format(total_hours), 
        transform=ax.transAxes, fontsize=14, fontweight='bold',
        verticalalignment='top',
        bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.8))

# 调整布局
plt.tight_layout()

# 保存图表
plt.savefig('work_hours_final_chart.png', dpi=300, bbox_inches='tight', 
           facecolor='white', edgecolor='none')

# 生成详细报告
print(u"\n" + "="*60)
print(u"项目工时分析报告")
print(u"="*60)
print(u"项目总工时: {:.1f}小时".format(total_hours))
print(u"")

for i, parent in enumerate(sorted_parents):
    total = parent_totals[parent]
    parent_percent = (total / total_hours) * 100
    print(u"{}. {} - {:.1f}小时 ({:.1f}%)".format(i+1, parent, total, parent_percent))
    
    # 显示该父需求下的主要子任务
    tasks = parent_data[parent]
    sorted_tasks = sorted(tasks.items(), key=lambda x: x[1], reverse=True)
    
    for j, (title, hours) in enumerate(sorted_tasks[:5]):  # 只显示前5个主要任务
        percentage = (hours / total) * 100
        if percentage >= 1:  # 只显示占比1%以上的任务
            print(u"   └─ {}: {:.1f}小时 ({:.1f}%)".format(title, hours, percentage))
    
    if len(sorted_tasks) > 5:
        other_hours = sum([hours for _, hours in sorted_tasks[5:]])
        if other_hours > 0:
            other_percent = (other_hours / total) * 100
            print(u"   └─ 其他{:d}项: {:.1f}小时 ({:.1f}%)".format(len(sorted_tasks)-5, other_hours, other_percent))
    print("")

print(u"图表已保存为: work_hours_final_chart.png")
print(u"="*60)
